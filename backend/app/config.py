from __future__ import annotations

import os


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


def service_version() -> str:
    return os.getenv("SERVICE_VERSION", "0.1.0")
