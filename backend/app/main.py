from __future__ import annotations

from contextlib import asynccontextmanager
from functools import lru_cache
from uuid import uuid4

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import cors_origins, service_version
from .knowledge import KnowledgeBase
from .media import MediaValidationError, validate_audio_upload, validate_image_upload
from .providers.dependencies import get_gemini_provider
from .providers.gemini import ProviderFailure
from .safety import safety_strings_approved
from .schemas import (
    ApiErrorResponse,
    BillConfirmRequest,
    DiagnosisResponse,
    HealthResponse,
    SupportedLanguage,
    TtsRequest,
)
from .services.diagnosis import diagnose as run_diagnosis


@asynccontextmanager
async def lifespan(application: FastAPI):
    yield
    provider = getattr(application.state, "gemini_provider", None)
    if provider is not None:
        await provider.aclose()


app = FastAPI(
    title="Ustaad AI API",
    description="Voice-first diagnostic and billing co-pilot API.",
    version=service_version(),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@lru_cache(maxsize=1)
def get_knowledge_base() -> KnowledgeBase:
    return KnowledgeBase.load()


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


def api_error(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details=None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    payload = ApiErrorResponse(
        error={
            "code": code,
            "message": message,
            "request_id": request_id,
            "details": details,
        }
    )
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(payload.model_dump()),
        headers={"X-Request-ID": request_id},
    )


def not_ready(request: Request, operation: str) -> JSONResponse:
    return api_error(
        request,
        status_code=503,
        code="MODEL_ERROR",
        message=f"The {operation} service is not implemented yet.",
        details={"operation": operation, "phase": "backend-foundation"},
    )


@app.exception_handler(MediaValidationError)
async def media_validation_error_handler(request: Request, exc: MediaValidationError):
    return api_error(
        request,
        status_code=exc.status_code,
        code=exc.code,
        message=str(exc),
        details={"field": exc.field},
    )


@app.exception_handler(ProviderFailure)
async def provider_failure_handler(request: Request, exc: ProviderFailure):
    return api_error(
        request,
        status_code=exc.status_code,
        code=exc.code,
        message=str(exc),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Do not echo submitted values (which may contain customer or transcript data).
    safe_details = [
        {
            "location": [str(part) for part in error.get("loc", ())],
            "message": error.get("msg", "Invalid value."),
            "type": error.get("type", "validation_error"),
        }
        for error in exc.errors()
    ]
    return api_error(
        request,
        status_code=400,
        code="INVALID_REQUEST",
        message="The request contains invalid or missing fields.",
        details=safe_details,
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, _exc: Exception):
    # Intentionally do not log exception bodies or request data.
    return api_error(
        request,
        status_code=500,
        code="INTERNAL_ERROR",
        message="An unexpected server error occurred. Please try again.",
    )


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(version=service_version())


@app.post("/api/diagnose", response_model=DiagnosisResponse, tags=["diagnosis"])
async def diagnose(
    request: Request,
    audio: UploadFile = File(...),
    image: UploadFile | None = File(default=None),
    lang: SupportedLanguage = Form(default="hinglish"),
):
    validated_audio = await validate_audio_upload(audio)
    validated_image = await validate_image_upload(image) if image is not None else None
    provider = get_gemini_provider(request)
    return await run_diagnosis(
        audio=validated_audio,
        image=validated_image,
        language=lang,
        provider=provider,
        knowledge_base=get_knowledge_base(),
        safety_approved=safety_strings_approved(),
    )


@app.post("/api/bill", tags=["billing"])
async def extract_bill(
    request: Request,
    audio: UploadFile = File(...),
    lang: SupportedLanguage = Form(default="hinglish"),
    customer_name: str | None = Form(default=None, max_length=80),
):
    # Billing shares the same server-side media boundary; extraction is Person B's workstream.
    await validate_audio_upload(audio)
    return not_ready(request, "bill extraction")


@app.post("/api/bill/confirm", tags=["billing"])
async def confirm_bill(request: Request, payload: BillConfirmRequest):
    # Billing confirmation remains a separate workstream; no calculations are performed here.
    return not_ready(request, "bill confirmation")


@app.post("/api/tts", tags=["speech"])
async def text_to_speech(request: Request, payload: TtsRequest):
    provider = get_gemini_provider(request)
    audio = await provider.synthesize_speech(payload.text, payload.lang)
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )
