from __future__ import annotations

import re
import time
from typing import Protocol

from ..diagnosis_models import DiagnosisExtraction
from ..knowledge import FaultEntry, KnowledgeBase, normalize_brand, normalize_code
from ..media import ValidatedAudio, ValidatedImage
from ..safety import Language, build_safety_alert
from ..schemas import DiagnosisResponse


class DiagnosisProvider(Protocol):
    async def extract_diagnosis(
        self,
        audio: ValidatedAudio,
        image: ValidatedImage | None,
        language: str,
    ) -> DiagnosisExtraction: ...


_DIGIT_WORDS = {
    "ZERO": "0", "SHUNYA": "0",
    "ONE": "1", "EK": "1",
    "TWO": "2", "DO": "2",
    "THREE": "3", "TEEN": "3",
    "FOUR": "4", "CHAR": "4", "CHAAR": "4",
    "FIVE": "5", "PAANCH": "5", "PANCH": "5",
    "SIX": "6", "CHHE": "6", "CHHEH": "6",
    "SEVEN": "7", "SAAT": "7",
    "EIGHT": "8", "AATH": "8",
    "NINE": "9", "NAU": "9",
}
_TENS = {
    "TWENTY": 20, "THIRTY": 30, "FORTY": 40, "FIFTY": 50,
    "SIXTY": 60, "SEVENTY": 70, "EIGHTY": 80, "NINETY": 90,
}


def _transcript_code_text(transcript: str) -> str:
    text = re.sub(r"[^A-Z0-9]+", " ", transcript.upper())
    for tens, value in _TENS.items():
        for unit, digit in _DIGIT_WORDS.items():
            if len(digit) == 1 and digit != "0":
                text = re.sub(
                    rf"\b{tens}\s+{unit}\b",
                    str(value + int(digit)),
                    text,
                )
    tokens = text.split()
    return " ".join(_DIGIT_WORDS.get(token, token) for token in tokens)


def _code_position(code: str, compact_transcript: str) -> int:
    """Find a code across adjacent spoken tokens without matching code suffixes.

    For example, C154 must not also match the Samsung alias 54. Conversely,
    "CH zero five" must still match CH05 after spoken-digit normalization.
    """
    # For paired Samsung codes, only the explicitly spoken suffix is an
    # accepted alias. Joining C1/54 into C154 creates a false collision.
    targets = [code.rsplit("/", 1)[1]] if "/" in code else [code]
    tokens = compact_transcript.split()
    offsets: list[int] = []
    cursor = 0
    for token in tokens:
        offsets.append(cursor)
        cursor += len(token) + 1

    matches: list[int] = []
    for target in targets:
        for start in range(len(tokens)):
            combined = ""
            for end in range(start, min(len(tokens), start + 4)):
                combined += tokens[end]
                if combined == target:
                    matches.append(offsets[start])
                    break
                if len(combined) >= len(target):
                    break
    return max(matches, default=-1)


def _code_supported_by_transcript(code: str, transcript: str) -> bool:
    return _code_position(code, _transcript_code_text(transcript)) >= 0


def _brand_from_transcript(
    transcript: str,
    knowledge_base: KnowledgeBase,
) -> tuple[str | None, bool]:
    """Recover explicit known-brand mentions from the transcript.

    The structured model sometimes leaves brand null even when its own transcript
    contains the manufacturer. Conflicting brands remain ungrounded.
    """
    patterns = {
        "LG": r"(?<![A-Z0-9])(?:L[\s.]*G|LGE)(?![A-Z0-9])",
        "Samsung": r"(?<![A-Z0-9])SAMSUNG(?:[\s]+ELECTRONICS)?(?![A-Z0-9])",
    }
    found: set[str] = set()
    upper = transcript.upper()
    for brand in {entry.brand for entry in knowledge_base.entries}:
        pattern = patterns.get(brand)
        if pattern and re.search(pattern, upper):
            found.add(brand)
    if len(found) > 1:
        return None, True
    return (next(iter(found)) if found else None), False


def _latest_entry_in_transcript(
    brand: str,
    transcript: str,
    knowledge_base: KnowledgeBase,
) -> FaultEntry | None:
    compact = _transcript_code_text(transcript)
    matches: list[tuple[int, FaultEntry]] = []
    for entry in knowledge_base.entries:
        if entry.brand != brand:
            continue
        for raw_code in entry.codes:
            normalized = normalize_code(raw_code)
            if not normalized:
                continue
            aliases = {normalized}
            if "/" in normalized:
                aliases.add(normalized.rsplit("/", 1)[1])
            for alias in aliases:
                position = _code_position(alias, compact)
                if position >= 0:
                    matches.append((position, entry))

    if not matches:
        return None
    latest_position = max(position for position, _ in matches)
    latest_entries = {
        entry.id for position, entry in matches if position == latest_position
    }
    if len(latest_entries) != 1:
        return None
    latest_id = next(iter(latest_entries))
    return next(entry for _, entry in matches if entry.id == latest_id)


def _confirmation_question(brand: str | None, code: str | None) -> str:
    if not brand and not code:
        return "AC ka brand aur display par dikh raha exact error code bataiye."
    if not brand:
        return "Yeh kis brand ka AC hai — LG, Samsung ya koi aur?"
    if not code:
        return "Display par exact error code kya dikh raha hai?"
    return f"Kya aapne {brand} ka {code} error code kaha?"


def _safe_unverified_steps() -> list[str]:
    return [
        "Check the exact code in the air conditioner's model-specific manual.",
        "If the code persists, stop troubleshooting and contact a qualified service technician.",
    ]


def _safe_photo_observation(note: str | None) -> str | None:
    if not note:
        return None
    # Images may support cautious physical observations, never code extraction or diagnosis.
    if re.search(r"\b(?:CH|C1|E|F|U)\s*[-/]?\s*\d{1,3}\b", note, re.IGNORECASE):
        return None
    if re.search(
        r"\b(?:error|fault|code|diagnos|cause|likely|probably|compressor|refrigerant|"
        r"sensor|motor|voltage|circuit|wiring|short)\b",
        note,
        re.IGNORECASE,
    ):
        return None
    if not re.search(
        r"\b(?:water|wet|drip|dripping|leak|ice|frost|dust|dirt|rust|corrosion|"
        r"stain|mold|mould|crack|cracked|broken|bent|burn|smoke|debris)\b",
        note,
        re.IGNORECASE,
    ):
        return None
    return note.strip()[:240]


def _build_grounded_response(
    extraction: DiagnosisExtraction,
    entry: FaultEntry,
    code: str,
    language: Language,
    latency_ms: int,
    photo_note: str | None,
    safety_approved: bool,
) -> DiagnosisResponse:
    safety_alert = build_safety_alert(
        entry.safety_tags,
        language,
        approved=safety_approved,
    )
    high_risk_tags = {"high_voltage", "refrigerant", "moving_parts", "water_drain"}
    requires_technician_only = (
        not safety_approved and bool(high_risk_tags.intersection(entry.safety_tags))
    )
    steps = [] if requires_technician_only else list(entry.checks[:4])
    spoken_summary = f"{entry.brand} {code}: {entry.meaning}. {safety_alert}"
    return DiagnosisResponse(
        transcript=extraction.transcript,
        detected_code=code,
        kb_id=entry.id,
        grounded=True,
        needs_confirmation=False,
        confirm_question=None,
        error_meaning=entry.meaning,
        probable_causes=list(entry.probable_causes[:4]),
        safety_alert=safety_alert,
        steps=steps,
        spoken_summary=spoken_summary,
        source=entry.source_title,
        photo_note=photo_note,
        provider="gemini",
        latency_ms=latency_ms,
    )


async def diagnose(
    *,
    audio: ValidatedAudio,
    image: ValidatedImage | None,
    language: Language,
    provider: DiagnosisProvider,
    knowledge_base: KnowledgeBase,
    safety_approved: bool = False,
) -> DiagnosisResponse:
    started = time.perf_counter()
    extraction = await provider.extract_diagnosis(audio, image, language)
    latency_ms = max(0, int((time.perf_counter() - started) * 1000))

    transcript_brand, multiple_transcript_brands = _brand_from_transcript(
        extraction.transcript,
        knowledge_base,
    )
    model_brand = normalize_brand(extraction.brand)
    brand_conflict = multiple_transcript_brands or bool(
        transcript_brand and model_brand and transcript_brand != model_brand
    )
    brand = None if brand_conflict else (transcript_brand or model_brand)
    code = normalize_code(extraction.detected_code)
    photo_note = _safe_photo_observation(extraction.photo_note) if image is not None else None
    entry = knowledge_base.lookup(brand, code)
    latest_entry = (
        _latest_entry_in_transcript(brand, extraction.transcript, knowledge_base)
        if brand
        else None
    )

    uncertain = (
        extraction.needs_confirmation
        or brand_conflict
        or not brand
        or not code
        or not _code_supported_by_transcript(code, extraction.transcript)
        or extraction.code_confidence < 0.80
        or (
            entry is not None
            and (latest_entry is None or latest_entry.id != entry.id)
        )
    )
    if uncertain:
        question = _confirmation_question(brand, code)
        safety_alert = build_safety_alert((), language, approved=safety_approved)
        return DiagnosisResponse(
            transcript=extraction.transcript,
            detected_code=code,
            kb_id=None,
            grounded=False,
            needs_confirmation=True,
            confirm_question=question,
            error_meaning=None,
            probable_causes=[],
            safety_alert=safety_alert,
            steps=[],
            spoken_summary=question,
            source=None,
            photo_note=photo_note,
            provider="gemini",
            latency_ms=latency_ms,
        )

    if entry is None:
        safety_alert = build_safety_alert((), language, approved=safety_approved)
        summary = (
            f"{brand} {code} is not in the verified knowledge base. "
            "Check the model-specific manual and contact a qualified technician if it persists."
        )
        return DiagnosisResponse(
            transcript=extraction.transcript,
            detected_code=code,
            kb_id=None,
            grounded=False,
            needs_confirmation=False,
            confirm_question=None,
            error_meaning=None,
            probable_causes=[],
            safety_alert=safety_alert,
            steps=_safe_unverified_steps(),
            spoken_summary=summary,
            source=None,
            photo_note=photo_note,
            provider="gemini",
            latency_ms=latency_ms,
        )

    return _build_grounded_response(
        extraction,
        entry,
        code,
        language,
        latency_ms,
        photo_note,
        safety_approved,
    )
