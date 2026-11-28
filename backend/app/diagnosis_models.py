from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DiagnosisExtraction(BaseModel):
    """Untrusted speech/image extraction; never contains authoritative diagnosis facts."""

    model_config = ConfigDict(extra="forbid")

    transcript: str = Field(min_length=1, max_length=1200)
    brand: str | None = Field(default=None, max_length=40)
    detected_code: str | None = Field(default=None, max_length=40)
    code_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    needs_confirmation: bool = False
    photo_note: str | None = Field(default=None, max_length=240)

    @field_validator("transcript")
    @classmethod
    def strip_transcript(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Transcript cannot be blank.")
        return value

    @field_validator("brand", "detected_code", "photo_note")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None
