from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SupportedLanguage = Literal["hi", "hinglish", "en"]
BillItemKind = Literal["part", "labour"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "ustaad-ai-api"
    version: str = "0.1.0"


class DiagnosisResponse(BaseModel):
    transcript: str
    detected_code: str | None
    kb_id: str | None
    grounded: bool
    needs_confirmation: bool
    confirm_question: str | None
    error_meaning: str | None
    probable_causes: list[str]
    safety_alert: str
    steps: list[str] = Field(max_length=4)
    spoken_summary: str
    source: str | None
    photo_note: str | None
    provider: str
    latency_ms: int = Field(ge=0)


class BillItemDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    qty: str = Field(min_length=1, max_length=20, pattern=r"^\d+(?:\.\d{1,3})?$")
    unit: str = Field(min_length=1, max_length=30)
    unit_price: str | None = Field(max_length=20, pattern=r"^\d{1,12}(?:\.\d{1,2})?$")
    kind: BillItemKind

    @field_validator("name", "unit")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value

    @field_validator("qty")
    @classmethod
    def validate_quantity(cls, value: str) -> str:
        try:
            amount = Decimal(value)
        except (InvalidOperation, ValueError):
            raise ValueError("Quantity must be a decimal string.") from None
        if not amount.is_finite() or amount <= 0:
            raise ValueError("Quantity must be greater than zero.")
        if max(0, -amount.as_tuple().exponent) > 3:
            raise ValueError("Quantity supports at most three decimal places.")
        return format(amount, "f")

    @field_validator("unit_price")
    @classmethod
    def validate_unit_price(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            amount = Decimal(value)
        except (InvalidOperation, ValueError):
            raise ValueError("Unit price must be a decimal string.") from None
        if not amount.is_finite() or amount < 0:
            raise ValueError("Unit price cannot be negative.")
        if amount != amount.quantize(Decimal("0.01")):
            raise ValueError("Unit price must have at most two decimal places.")
        return format(amount, ".2f")


class BillItem(BillItemDraft):
    needs_confirmation: bool = False


class BillExtractionResponse(BaseModel):
    transcript: str
    customer: str | None
    items: list[BillItem]
    unsupported_mentions: list[str]
    total: str | None
    total_complete: bool
    whatsapp_text: str | None
    provider: str
    latency_ms: int = Field(ge=0)


class BillConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer: str | None = Field(default=None, max_length=80)
    items: list[BillItemDraft] = Field(min_length=1, max_length=50)
    unsupported_mentions: list[str] = Field(default_factory=list, max_length=20)


class ConfirmedBillItem(BillItem):
    line_total: str | None


class BillConfirmResponse(BaseModel):
    items: list[ConfirmedBillItem]
    subtotal: str | None
    total: str | None
    total_complete: bool
    whatsapp_text: str | None


class TtsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=1200)
    lang: SupportedLanguage = "hinglish"

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Text cannot be blank.")
        return value


class ApiError(BaseModel):
    code: str
    message: str
    request_id: str
    details: Any | None = None


class ApiErrorResponse(BaseModel):
    error: ApiError
