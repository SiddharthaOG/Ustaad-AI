from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

Language = Literal["hi", "hinglish", "en"]

# Conservative fallback remains active until the draft translations are
# explicitly reviewed by the project owner/technician and approved in config.
_FALLBACK = {
    "en": "Switch off power before inspection. Do not open electrical panels or touch wiring unless qualified. If unsure, stop and contact a trained technician.",
    "hi": "जाँच से पहले बिजली बंद करें। योग्य न हों तो बिजली के पैनल न खोलें और तारों को न छुएँ। संदेह हो तो काम रोकें और प्रशिक्षित तकनीशियन से संपर्क करें।",
    "hinglish": "Inspection se pehle power band karein. Qualified na hon to electrical panel na kholein aur wiring ko na chhuyein. Shak ho to kaam rokein aur trained technician se contact karein.",
}
_HIGH_RISK_FALLBACK = {
    "en": "Do not touch internal components; a trained technician must handle this inspection.",
    "hi": "अंदरूनी हिस्सों को न छुएँ; इसकी जाँच प्रशिक्षित तकनीशियन से ही करवाएँ।",
    "hinglish": "Internal components ko na chhuyein; iski jaanch trained technician se hi karwayein.",
}
_HIGH_RISK_TAGS = {"high_voltage", "refrigerant", "moving_parts", "water_drain"}


def _load_draft(path: Path | None = None) -> dict:
    if path is None:
        path = Path(__file__).resolve().parents[1] / "data" / "safety_strings.draft.json"
    return json.loads(path.read_text(encoding="utf-8"))


def build_safety_alert(
    safety_tags: tuple[str, ...] | list[str],
    language: Language,
    *,
    approved: bool = False,
    path: Path | None = None,
) -> str:
    if not approved:
        message = _FALLBACK[language]
        if _HIGH_RISK_TAGS.intersection(safety_tags):
            message = f"{message} {_HIGH_RISK_FALLBACK[language]}"
        return message

    payload = _load_draft(path)
    strings = payload.get("strings", {})
    order = payload.get("order", [])
    keys = ["general", *(tag for tag in order if tag in safety_tags and tag != "general")]
    messages: list[str] = []
    for key in keys:
        translations = strings.get(key, {})
        message = translations.get(language) or translations.get("en")
        if message and message not in messages:
            messages.append(message.strip())
    return " ".join(messages) if messages else _FALLBACK[language]


def safety_strings_approved() -> bool:
    return os.getenv("SAFETY_STRINGS_APPROVED", "false").strip().lower() in {"1", "true", "yes"}
