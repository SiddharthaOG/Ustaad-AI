from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


def normalize_brand(value: str | None) -> str | None:
    if not value:
        return None
    compact = re.sub(r"[^A-Z0-9]", "", value.upper())
    if compact in {"LG", "LGE", "LIFESGOOD", "LGAC", "LGELECTRONICS"}:
        return "LG"
    if compact in {"SAMSUNG", "SAMSUNGELECTRONICS", "SAMSUNGAC"}:
        return "Samsung"
    return value.strip()


def normalize_code(value: str | None) -> str | None:
    if not value:
        return None
    # Remove explanatory notes such as "(blinking in loop)" before matching.
    value = value.split("(", 1)[0].strip().upper()
    value = re.sub(r"\s*/\s*", "/", value)
    compact = re.sub(r"[^A-Z0-9/]", "", value)
    return compact or None


def _code_aliases(raw_code: str) -> set[str]:
    normalized = normalize_code(raw_code)
    if not normalized:
        return set()
    aliases = {normalized}
    # Samsung's source pack also describes codes as alternating C1/NN or E1/NN.
    # The suffix is accepted only within that brand and only if unique in the KB.
    if "/" in normalized:
        suffix = normalized.rsplit("/", 1)[1]
        if suffix.isdigit():
            aliases.add(suffix)
    return aliases


def _official_source_for_brand(brand: str, sources: list[dict]) -> dict | None:
    allowed_domain = "lg.com" if brand == "LG" else "samsung.com" if brand == "Samsung" else None
    if not allowed_domain:
        return None
    for source in sources:
        url = source.get("url", "")
        host = (urlparse(url).hostname or "").lower()
        if host == allowed_domain or host.endswith("." + allowed_domain):
            if source.get("title"):
                return source
    return None


@dataclass(frozen=True)
class FaultEntry:
    id: str
    brand: str
    model_series: str
    codes: tuple[str, ...]
    meaning: str
    probable_causes: tuple[str, ...]
    checks: tuple[str, ...]
    safety_tags: tuple[str, ...]
    source_title: str


class KnowledgeBase:
    def __init__(self, entries: list[FaultEntry]) -> None:
        self.entries = tuple(entries)
        index: dict[tuple[str, str], FaultEntry | None] = {}
        for entry in self.entries:
            for raw_code in entry.codes:
                for alias in _code_aliases(raw_code):
                    key = (entry.brand, alias)
                    if key not in index:
                        index[key] = entry
                    elif index[key] is not None and index[key].id != entry.id:
                        index[key] = None  # ambiguous aliases must never ground
        self._index = index

    @classmethod
    def load(cls, path: Path | None = None) -> "KnowledgeBase":
        if path is None:
            path = Path(__file__).resolve().parents[1] / "data" / "error_codes.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        entries: list[FaultEntry] = []

        for raw in payload.get("entries", []):
            if raw.get("category") != "split_ac" or raw.get("verified") is not True:
                continue
            brand = normalize_brand(raw.get("brand"))
            if brand not in {"LG", "Samsung"}:
                continue
            source = _official_source_for_brand(brand, raw.get("sources", []))
            if source is None or not raw.get("checked_on"):
                continue
            required = ("id", "model_series", "meaning", "codes")
            if any(not raw.get(field) for field in required):
                continue
            entries.append(
                FaultEntry(
                    id=str(raw["id"]),
                    brand=brand,
                    model_series=str(raw["model_series"]),
                    codes=tuple(str(code) for code in raw["codes"]),
                    meaning=str(raw["meaning"]),
                    probable_causes=tuple(str(item) for item in raw.get("probable_causes", [])),
                    checks=tuple(str(item) for item in raw.get("checks", [])),
                    safety_tags=tuple(str(item) for item in raw.get("safety_tags", [])),
                    source_title=str(source["title"]),
                )
            )
        return cls(entries)

    def lookup(self, brand: str | None, code: str | None) -> FaultEntry | None:
        canonical_brand = normalize_brand(brand)
        canonical_code = normalize_code(code)
        if canonical_brand is None or canonical_code is None:
            return None
        return self._index.get((canonical_brand, canonical_code))
