from __future__ import annotations

from fastapi import Request

from ..config import gemini_api_key, gemini_model, gemini_timeout_seconds
from .gemini import GeminiProvider, ProviderFailure


def get_gemini_provider(request: Request) -> GeminiProvider:
    provider = getattr(request.app.state, "gemini_provider", None)
    if provider is not None:
        return provider
    api_key = gemini_api_key()
    if not api_key:
        raise ProviderFailure(
            "MODEL_ERROR",
            "The diagnosis service is not configured. Set GEMINI_API_KEY on the backend.",
            503,
        )
    provider = GeminiProvider(
        api_key=api_key,
        model=gemini_model(),
        timeout_seconds=gemini_timeout_seconds(),
    )
    request.app.state.gemini_provider = provider
    return provider
