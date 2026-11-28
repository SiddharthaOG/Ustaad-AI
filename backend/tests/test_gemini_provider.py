import asyncio
import json
from types import SimpleNamespace

import pytest
import httpx
from google.genai import errors

from backend.app.diagnosis_models import DiagnosisExtraction
from backend.app.media import ValidatedAudio, ValidatedImage
from backend.app.providers.gemini import GeminiProvider, ProviderFailure


class FakeModels:
    def __init__(self, text, delay=0):
        self.text = text
        self.delay = delay
        self.kwargs = None

    async def generate_content(self, **kwargs):
        self.kwargs = kwargs
        if self.delay:
            await asyncio.sleep(self.delay)
        return SimpleNamespace(text=self.text)


class FakeAio:
    def __init__(self, models):
        self.models = models
        self.closed = False

    async def aclose(self):
        self.closed = True


class FakeClient:
    def __init__(self, models):
        self.aio = FakeAio(models)


def valid_payload():
    return {
        "transcript": "LG AC me CH zero five aa raha hai",
        "brand": "LG",
        "detected_code": "CH05",
        "code_confidence": 0.99,
        "needs_confirmation": False,
        "photo_note": None,
    }


def test_provider_sends_inline_audio_and_structured_output_schema():
    models = FakeModels(json.dumps(valid_payload()))
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=1)
    provider._client = FakeClient(models)

    result = asyncio.run(
        provider.extract_diagnosis(
            ValidatedAudio(data=b"wav-bytes", duration_seconds=1),
            ValidatedImage(100, 320, 240, b"jpeg-bytes"),
            "hinglish",
        )
    )

    assert isinstance(result, DiagnosisExtraction)
    assert result.detected_code == "CH05"
    assert models.kwargs["model"] == "gemini-test"
    assert models.kwargs["config"]["response_mime_type"] == "application/json"
    assert models.kwargs["config"]["response_json_schema"]["type"] == "object"
    assert len(models.kwargs["contents"]) == 3


def test_provider_rejects_malformed_structured_output():
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=1)
    provider._client = FakeClient(FakeModels("not-json"))

    with pytest.raises(ProviderFailure) as error:
        asyncio.run(
            provider.extract_diagnosis(
                ValidatedAudio(data=b"wav", duration_seconds=1),
                None,
                "hi",
            )
        )
    assert error.value.code == "MODEL_BAD_OUTPUT"
    assert error.value.status_code == 502


def test_provider_maps_timeout_to_model_timeout():
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=0.01)
    provider._client = FakeClient(FakeModels(json.dumps(valid_payload()), delay=0.1))

    with pytest.raises(ProviderFailure) as error:
        asyncio.run(
            provider.extract_diagnosis(
                ValidatedAudio(data=b"wav", duration_seconds=1),
                None,
                "en",
            )
        )
    assert error.value.code == "MODEL_TIMEOUT"
    assert error.value.status_code == 504


def test_shared_transcription_interface_returns_plain_transcript():
    models = FakeModels("LG AC me CH zero five aa raha hai")
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=1)
    provider._client = FakeClient(models)

    transcript = asyncio.run(
        provider.transcribe_audio(
            ValidatedAudio(data=b"wav-bytes", duration_seconds=1),
            "hinglish",
        )
    )

    assert transcript == "LG AC me CH zero five aa raha hai"
    assert len(models.kwargs["contents"]) == 2
    assert "response_json_schema" not in models.kwargs["config"]


class SequencedModels:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0
        self.last_kwargs = None

    async def generate_content(self, **kwargs):
        self.calls += 1
        self.last_kwargs = kwargs
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        if hasattr(outcome, "candidates"):
            return outcome
        return SimpleNamespace(text=outcome)


def test_provider_retries_transient_503_then_succeeds():
    models = SequencedModels([
        errors.APIError(503, {"error": {"message": "temporarily unavailable"}}),
        json.dumps(valid_payload()),
    ])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=3)
    provider._client = FakeClient(models)

    result = asyncio.run(provider.generate_structured(["prompt"], DiagnosisExtraction))

    assert result.detected_code == "CH05"
    assert models.calls == 2


def test_provider_retries_rate_limit_and_returns_specific_error():
    models = SequencedModels([
        errors.APIError(429, {"error": {"message": "rate limited"}}),
        errors.APIError(429, {"error": {"message": "rate limited"}}),
        errors.APIError(429, {"error": {"message": "rate limited"}}),
    ])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=3)
    provider._client = FakeClient(models)

    with pytest.raises(ProviderFailure) as error:
        asyncio.run(provider.generate_structured(["prompt"], DiagnosisExtraction))

    assert error.value.code == "RATE_LIMITED"
    assert error.value.status_code == 429
    assert models.calls == 3


def test_provider_does_not_retry_invalid_credentials():
    models = SequencedModels([errors.APIError(401, {"error": {"message": "unauthorized"}})])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=3)
    provider._client = FakeClient(models)

    with pytest.raises(ProviderFailure) as error:
        asyncio.run(provider.generate_structured(["prompt"], DiagnosisExtraction))

    assert error.value.code == "MODEL_CONFIGURATION"
    assert error.value.status_code == 502
    assert models.calls == 1


def test_provider_honours_short_google_retry_info_then_succeeds():
    rate_limit = errors.APIError(429, {"error": {"details": [
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "0.01s"}
    ]}})
    models = SequencedModels([rate_limit, json.dumps(valid_payload())])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=2)
    provider._client = FakeClient(models)

    result = asyncio.run(provider.generate_structured(["prompt"], DiagnosisExtraction))

    assert result.detected_code == "CH05"
    assert models.calls == 2


def test_provider_does_not_retry_beyond_remaining_budget_from_retry_info():
    rate_limit = errors.APIError(429, {"error": {"details": [
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "47s"}
    ]}})
    models = SequencedModels([rate_limit])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=1)
    provider._client = FakeClient(models)

    with pytest.raises(ProviderFailure) as error:
        asyncio.run(provider.generate_structured(["prompt"], DiagnosisExtraction))

    assert error.value.code == "RATE_LIMITED"
    assert models.calls == 1


def test_provider_synthesizes_wav_with_dedicated_tts_model(monkeypatch):
    import io
    import wave

    monkeypatch.setenv("GEMINI_TTS_MODEL", "gemini-3.8-flash-lite-tts")
    monkeypatch.setenv("GEMINI_TTS_VOICE", "Kore")
    pcm = b"\x00\x00" * 240
    inline = SimpleNamespace(data=pcm, mime_type="audio/L16;rate=24000")
    part = SimpleNamespace(inline_data=inline)
    response = SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))])
    models = SequencedModels([response])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=2)
    provider._client = FakeClient(models)

    audio = asyncio.run(provider.synthesize_speech("Namaste, Ustaad yahan hai.", "hinglish"))

    assert audio[:4] == b"RIFF"
    assert models.calls == 1
    assert models.last_kwargs["model"] == "gemini-3.8-flash-lite-tts"
    assert models.last_kwargs["config"]["response_modalities"] == ["AUDIO"]
    with wave.open(io.BytesIO(audio), "rb") as wav:
        assert wav.getframerate() == 24_000
        assert wav.getnchannels() == 1
        assert wav.getsampwidth() == 2
        assert wav.getnframes() == 240


def test_provider_rejects_empty_tts_audio(monkeypatch):
    monkeypatch.setenv("GEMINI_TTS_MODEL", "gemini-3.8-flash-lite-tts")
    part = SimpleNamespace(inline_data=SimpleNamespace(data=b"", mime_type="audio/L16;rate=24000"))
    response = SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))])
    models = SequencedModels([response])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=2)
    provider._client = FakeClient(models)

    with pytest.raises(ProviderFailure) as error:
        asyncio.run(provider.synthesize_speech("Hello", "en"))

    assert error.value.code == "MODEL_BAD_OUTPUT"


def test_provider_retries_transient_transport_error_then_succeeds():
    request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
    models = SequencedModels([
        httpx.ConnectError("connection reset", request=request),
        json.dumps(valid_payload()),
    ])
    provider = GeminiProvider("test-key", "gemini-test", timeout_seconds=3)
    provider._client = FakeClient(models)

    result = asyncio.run(provider.generate_structured(["prompt"], DiagnosisExtraction))

    assert result.detected_code == "CH05"
    assert models.calls == 2
