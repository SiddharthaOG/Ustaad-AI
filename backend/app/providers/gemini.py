from __future__ import annotations

import asyncio
from io import BytesIO
import wave

import httpx
from typing import TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from ..diagnosis_models import DiagnosisExtraction
from ..media import ValidatedAudio, ValidatedImage

ModelT = TypeVar("ModelT", bound=BaseModel)
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3
_MAX_ATTEMPT_SECONDS = 20.0


class ProviderFailure(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class GeminiProvider:
    """Shared Gemini client with a bounded retry budget for transient failures."""

    def __init__(self, api_key: str, model: str, timeout_seconds: float = 45.0) -> None:
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._client = genai.Client(api_key=api_key)

    @staticmethod
    def _retry_after_seconds(error: errors.APIError, fallback: float) -> float:
        response = getattr(error, "response", None)
        headers = getattr(response, "headers", None)
        if headers:
            value = headers.get("retry-after") or headers.get("Retry-After")
            if value:
                try:
                    return min(max(float(value), 0.0), 120.0)
                except (TypeError, ValueError):
                    pass

        payload = getattr(error, "response_json", None) or getattr(error, "details", None)
        details = payload.get("error", {}).get("details", []) if isinstance(payload, dict) else []
        for detail in details:
            if not isinstance(detail, dict) or not str(detail.get("@type", "")).endswith("RetryInfo"):
                continue
            value = str(detail.get("retryDelay", "")).strip()
            try:
                seconds = float(value[:-1] if value.endswith("s") else value)
                return min(max(seconds, 0.0), 120.0)
            except (TypeError, ValueError):
                continue
        return fallback

    async def _generate_response(
        self,
        model: str,
        contents: list[str | types.Part],
        config: dict,
    ):
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self.timeout_seconds
        response = None

        for attempt in range(_MAX_ATTEMPTS):
            remaining = deadline - loop.time()
            if remaining <= 0:
                break
            try:
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=model,
                        contents=contents,
                        config=config,
                    ),
                    timeout=min(_MAX_ATTEMPT_SECONDS, remaining),
                )
                break
            except (asyncio.TimeoutError, httpx.TimeoutException):
                remaining = deadline - loop.time()
                if attempt + 1 >= _MAX_ATTEMPTS or remaining <= 0.25:
                    raise ProviderFailure(
                        "MODEL_TIMEOUT", "The AI service took too long. Please try again.", 504
                    ) from None
                await asyncio.sleep(min(0.25 * (2 ** attempt), remaining))
            except errors.APIError as exc:
                status = getattr(exc, "code", None) or getattr(exc, "status", None)
                if status in _RETRYABLE_STATUS_CODES and attempt + 1 < _MAX_ATTEMPTS:
                    remaining = deadline - loop.time()
                    delay = self._retry_after_seconds(exc, 0.25 * (2 ** attempt))
                    if remaining > delay + 0.05:
                        await asyncio.sleep(delay)
                        continue
                if status == 429:
                    raise ProviderFailure(
                        "RATE_LIMITED", "The AI service is busy. Please wait a moment and try again.", 429
                    ) from None
                if status in {401, 403, 404}:
                    raise ProviderFailure(
                        "MODEL_CONFIGURATION",
                        "The AI service configuration or model access is invalid.",
                        502,
                    ) from None
                raise ProviderFailure(
                    "MODEL_ERROR", "The AI service is temporarily unavailable. Please try again.", 503
                ) from None
            except (httpx.TransportError, ConnectionError, OSError):
                remaining = deadline - loop.time()
                if attempt + 1 < _MAX_ATTEMPTS and remaining > 0.25:
                    await asyncio.sleep(min(0.25 * (2 ** attempt), remaining))
                    continue
                raise ProviderFailure(
                    "MODEL_ERROR", "The AI service could not be reached. Please try again.", 503
                ) from None
            except Exception:
                raise ProviderFailure(
                    "MODEL_ERROR", "The AI service could not process this request.", 503
                ) from None

        if response is None:
            raise ProviderFailure(
                "MODEL_TIMEOUT", "The AI service took too long. Please try again.", 504
            )
        return response

    async def _generate(
        self,
        contents: list[str | types.Part],
        response_model: type[BaseModel] | None = None,
        *,
        max_output_tokens: int = 512,
    ) -> str:
        config: dict = {
            "temperature": 0.1,
            "max_output_tokens": max_output_tokens,
        }
        if response_model is not None:
            config["response_mime_type"] = "application/json"
            config["response_json_schema"] = response_model.model_json_schema()

        response = await self._generate_response(self.model, contents, config)
        text = response.text
        if not text or not text.strip():
            raise ProviderFailure(
                "MODEL_BAD_OUTPUT", "The AI service returned an empty response.", 502
            )
        return text.strip()

    async def generate_structured(
        self,
        contents: list[str | types.Part],
        response_model: type[ModelT],
    ) -> ModelT:
        text = await self._generate(contents, response_model)
        try:
            return response_model.model_validate_json(text)
        except (ValidationError, ValueError):
            raise ProviderFailure(
                "MODEL_BAD_OUTPUT", "The AI service returned an invalid structured response.", 502
            ) from None

    async def transcribe_audio(self, audio: ValidatedAudio, language: str) -> str:
        language_name = {"hi": "Hindi", "hinglish": "Hinglish", "en": "English"}.get(
            language, "Hinglish"
        )
        prompt = (
            "Transcribe the supplied mechanic's recording accurately and verbatim. "
            f"Keep the original spoken language ({language_name}); do not translate, summarize, "
            "correct grammar, infer missing words, or add commentary. Return only the transcript."
        )
        transcript = await self._generate(
            [
                prompt,
                types.Part.from_bytes(data=audio.data, mime_type="audio/wav"),
            ],
            max_output_tokens=1024,
        )
        if len(transcript) > 1200:
            raise ProviderFailure(
                "MODEL_BAD_OUTPUT", "The transcription exceeded the supported length.", 502
            )
        return transcript

    async def extract_diagnosis(
        self,
        audio: ValidatedAudio,
        image: ValidatedImage | None,
        language: str,
    ) -> DiagnosisExtraction:
        language_name = {"hi": "Hindi", "hinglish": "Hinglish", "en": "English"}.get(
            language, "Hinglish"
        )
        prompt = (
            "You are a speech transcription and field-extraction component for an AC service app, "
            "not a technician and not a diagnostic authority.\n"
            f"Transcribe the mechanic's speech faithfully in {language_name}; do not translate it.\n"
            "Extract the manufacturer brand and the currently active/displayed error code only "
            "when explicitly supported by the audio. If the speaker mentions an earlier code and "
            "then says a different code is showing now, select the latest/current code. Do not "
            "infer a code from symptoms, brand habits, or the image. Normalize spoken digits in "
            "codes where clear (for example, 'CH zero five' to 'CH05').\n"
            "If brand or code is unclear, leave that field null and set needs_confirmation=true. "
            "Set code_confidence conservatively between 0 and 1; it is a rough uncertainty signal, "
            "not proof. Never invent a brand or code.\n"
            "Do not provide fault meanings, causes, repair steps, prices, safety advice, or source "
            "citations. The backend will retrieve verified facts independently.\n"
            "If an image is present, photo_note may describe only a cautious visible physical "
            "observation (for example, visible water near the indoor unit). Do not read or infer "
            "error codes from the image and do not diagnose from the image. If no useful visual "
            "observation exists, return null."
        )

        contents: list[str | types.Part] = [
            prompt,
            types.Part.from_bytes(data=audio.data, mime_type="audio/wav"),
        ]
        if image is not None:
            contents.append(types.Part.from_bytes(data=image.data, mime_type="image/jpeg"))
        return await self.generate_structured(contents, DiagnosisExtraction)

    async def synthesize_speech(self, text: str, language: str) -> bytes:
        from ..config import gemini_tts_model, gemini_tts_voice

        language_name = {"hi": "Hindi", "hinglish": "Hindi-English Hinglish", "en": "Indian English"}.get(
            language, "Hindi-English Hinglish"
        )
        # Gemini TTS can read every content item aloud. Keep style guidance and the
        # delimited payload in one prompt so a separate instruction item cannot leak
        # into the generated speech.
        prompt = (
            f"Generate speech in natural conversational {language_name}, with clear Indian "
            "pronunciation, a calm helpful technician tone, and a moderate pace. "
            "Speak ONLY the exact text between <SPEAK> and </SPEAK>. "
            "Do not speak these instructions or the delimiter tags. Do not add a greeting, "
            "introduction, explanation, or closing.\n\n"
            f"<SPEAK>\n{text}\n</SPEAK>"
        )
        config = {
            "response_modalities": ["AUDIO"],
            "speech_config": types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=gemini_tts_voice()
                    )
                )
            ),
        }
        response = await self._generate_response(
            gemini_tts_model(),
            [prompt],
            config,
        )
        audio_data = None
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            for part in getattr(content, "parts", []) or []:
                inline = getattr(part, "inline_data", None)
                if inline is not None and getattr(inline, "data", None):
                    audio_data = inline.data
                    break
            if audio_data is not None:
                break
        if not audio_data or len(audio_data) % 2:
            raise ProviderFailure(
                "MODEL_BAD_OUTPUT", "The speech service returned invalid audio.", 502
            )

        output = BytesIO()
        try:
            with wave.open(output, "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(24_000)
                wav.writeframes(audio_data)
        except (wave.Error, ValueError):
            raise ProviderFailure(
                "MODEL_BAD_OUTPUT", "The speech service returned invalid audio.", 502
            ) from None
        return output.getvalue()

    async def aclose(self) -> None:
        await self._client.aio.aclose()
