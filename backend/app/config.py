from __future__ import annotations

import os


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


def service_version() -> str:
    return os.getenv("SERVICE_VERSION", "0.1.0")


def gemini_api_key() -> str | None:
    value = os.getenv("GEMINI_API_KEY", "").strip()
    return value or None


def gemini_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()


def gemini_timeout_seconds() -> float:
    try:
        value = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "45"))
    except ValueError:
        return 45.0
    return min(max(value, 5.0), 90.0)


def gemini_tts_model() -> str:
    return os.getenv("GEMINI_TTS_MODEL", "gemini-3.8-flash-lite-tts").strip()


def gemini_tts_voice() -> str:
    return os.getenv("GEMINI_TTS_VOICE", "Kore").strip() or "Kore"
