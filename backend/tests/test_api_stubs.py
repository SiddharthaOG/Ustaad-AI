import asyncio
import struct

import httpx
from PIL import Image
import io

from backend.app.main import app


def make_wav(seconds: int = 1) -> bytes:
    sample_rate = 16_000
    audio = b"\x00" * (sample_rate * seconds * 2)
    fmt = struct.pack("<HHIIHH", 1, 1, sample_rate, 32_000, 2, 16)
    body = b"fmt " + struct.pack("<I", len(fmt)) + fmt
    body += b"data" + struct.pack("<I", len(audio)) + audio
    return b"RIFF" + struct.pack("<I", len(body) + 4) + b"WAVE" + body


def make_jpeg() -> bytes:
    image = Image.new("RGB", (32, 32), (80, 120, 160))
    output = io.BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def api_request(method: str, path: str, **kwargs):
    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(send())


def assert_not_ready(response, operation: str):
    assert response.status_code == 503
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "MODEL_ERROR"
    assert body["error"]["request_id"] == response.headers["x-request-id"]
    assert body["error"]["details"]["operation"] == operation
    assert "not implemented yet" in body["error"]["message"]


def test_diagnosis_valid_media_requires_gemini_configuration(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delattr(app.state, "gemini_provider", raising=False)
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={
            "audio": ("sample.wav", make_wav(), "audio/wav"),
            "image": ("sample.jpg", make_jpeg(), "image/jpeg"),
        },
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "MODEL_ERROR"
    assert "GEMINI_API_KEY" in response.json()["error"]["message"]


def test_diagnosis_route_returns_grounded_kb_response_with_fake_provider(monkeypatch):
    from backend.app.diagnosis_models import DiagnosisExtraction

    class FakeProvider:
        async def extract_diagnosis(self, audio, image, language):
            assert audio.sample_rate == 16_000
            assert image is None
            assert language == "hinglish"
            return DiagnosisExtraction(
                transcript="LG AC me CH zero five aa raha hai",
                brand="LG",
                detected_code="CH05",
                code_confidence=0.99,
                needs_confirmation=False,
            )

    monkeypatch.setattr(app.state, "gemini_provider", FakeProvider(), raising=False)
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={"audio": ("sample.wav", make_wav(), "audio/wav")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is True
    assert body["kb_id"] == "lg-ch05"
    assert body["detected_code"] == "CH05"
    assert body["source"].startswith("LG India")
    assert body["safety_alert"]
    assert len(body["steps"]) <= 4


def test_diagnosis_rejects_invalid_audio_before_model_pipeline():
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={"audio": ("sample.wav", b"not a wav", "audio/wav")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "AUDIO_INVALID"
    assert response.headers["x-request-id"] == response.json()["error"]["request_id"]


def test_diagnosis_rejects_invalid_optional_image():
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={
            "audio": ("sample.wav", make_wav(), "audio/wav"),
            "image": ("sample.jpg", b"not a jpeg", "image/jpeg"),
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "IMAGE_INVALID"


def test_diagnosis_rejects_wrong_audio_media_type():
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={"audio": ("sample.mp3", make_wav(), "audio/mpeg")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_diagnosis_rejects_audio_over_limit():
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={"audio": ("sample.wav", b"x" * (2 * 1024 * 1024 + 1), "audio/wav")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_diagnosis_rejects_image_over_limit():
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={
            "audio": ("sample.wav", make_wav(), "audio/wav"),
            "image": ("sample.jpg", b"x" * (int(1.5 * 1024 * 1024) + 1), "image/jpeg"),
        },
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_diagnosis_rejects_wrong_image_media_type():
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={
            "audio": ("sample.wav", make_wav(), "audio/wav"),
            "image": ("sample.png", make_jpeg(), "image/png"),
        },
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_bill_audio_uses_same_server_validation_then_returns_stub():
    response = api_request(
        "POST",
        "/api/bill",
        data={"lang": "hi", "customer_name": "Ramesh"},
        files={"audio": ("sample.wav", make_wav(), "audio/wav")},
    )
    assert_not_ready(response, "bill extraction")


def test_bill_rejects_invalid_audio():
    response = api_request(
        "POST",
        "/api/bill",
        data={"lang": "hi"},
        files={"audio": ("sample.wav", b"placeholder", "audio/wav")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "AUDIO_INVALID"


def test_bill_confirmation_route_remains_stub():
    response = api_request(
        "POST",
        "/api/bill/confirm",
        json={
            "customer": "Ramesh",
            "items": [
                {
                    "name": "Capacitor",
                    "qty": "1",
                    "unit": "piece",
                    "unit_price": "250.00",
                    "kind": "part",
                }
            ],
            "unsupported_mentions": [],
        },
    )
    assert_not_ready(response, "bill confirmation")


def test_tts_route_returns_wav_audio_with_fake_provider(monkeypatch):
    class FakeTtsProvider:
        async def synthesize_speech(self, text, language):
            assert text == "Pehle main MCB band karein."
            assert language == "hinglish"
            return b"RIFF\\x00\\x00\\x00\\x00WAVEtest"

    monkeypatch.setattr(app.state, "gemini_provider", FakeTtsProvider(), raising=False)
    response = api_request(
        "POST",
        "/api/tts",
        json={"text": "Pehle main MCB band karein.", "lang": "hinglish"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.content.startswith(b"RIFF")
    assert response.headers["cache-control"] == "no-store"


def test_invalid_confirmation_is_standardized_without_echoing_input():
    response = api_request(
        "POST",
        "/api/bill/confirm",
        json={
            "customer": "PRIVATE CUSTOMER",
            "items": [
                {
                    "name": "Capacitor",
                    "qty": "-1",
                    "unit": "piece",
                    "unit_price": "250.00",
                    "kind": "part",
                }
            ],
            "unsupported_mentions": [],
        },
    )

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "INVALID_REQUEST"
    assert error["request_id"] == response.headers["x-request-id"]
    assert "PRIVATE CUSTOMER" not in response.text
