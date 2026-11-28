from backend.app.knowledge import FaultEntry, KnowledgeBase, normalize_code, normalize_brand
from backend.app.safety import build_safety_alert


def test_source_pack_loads_only_verified_official_entries():
    kb = KnowledgeBase.load()
    assert len(kb.entries) == 13
    assert all(entry.brand in {"LG", "Samsung"} for entry in kb.entries)


def test_lg_aliases_match_only_with_lg_brand():
    kb = KnowledgeBase.load()
    assert kb.lookup("LG", "CH05").id == "lg-ch05"
    assert kb.lookup("LG", "E0").id == "lg-ch05"
    assert kb.lookup("LG", "E6").id == "lg-ch10"
    assert kb.lookup("Voltas", "E6") is None


def test_samsung_slash_and_suffix_aliases_match():
    kb = KnowledgeBase.load()
    assert kb.lookup("Samsung", "C1 / 21 (blinking in loop)").id == "samsung-21"
    assert kb.lookup("Samsung", "21").id == "samsung-21"
    assert kb.lookup("Samsung", "63").id == "samsung-63"
    assert kb.lookup("Samsung", "C154").id == "samsung-c154"


def test_unverified_codes_are_never_grounded():
    kb = KnowledgeBase.load()
    assert kb.lookup("LG", "CH90") is None
    assert kb.lookup("LG", "CH41") is None
    assert kb.lookup("Samsung", "E101") is None


def test_missing_brand_or_code_never_matches():
    kb = KnowledgeBase.load()
    assert kb.lookup(None, "CH05") is None
    assert kb.lookup("LG", None) is None
    assert kb.lookup("Voltas", "CH05") is None


def test_normalizers_are_conservative():
    assert normalize_brand("L.G.") == "LG"
    assert normalize_brand("Samsung Electronics") == "Samsung"
    assert normalize_code(" c1 / 21 (blinking in loop) ") == "C1/21"


def _entry(entry_id: str, code: str) -> FaultEntry:
    return FaultEntry(
        id=entry_id,
        brand="LG",
        model_series="test",
        codes=(code,),
        meaning="test meaning",
        probable_causes=(),
        checks=(),
        safety_tags=(),
        source_title="test source",
    )


def test_ambiguous_alias_never_matches():
    kb = KnowledgeBase([_entry("one", "X1"), _entry("two", "X1")])
    assert kb.lookup("LG", "X1") is None


def test_safety_fallback_is_used_until_draft_translations_are_approved():
    alert = build_safety_alert(["electrical", "refrigerant"], "hinglish")
    assert "power band karein" in alert
    assert "refrigerant" not in alert.lower()


def test_approved_safety_strings_follow_deterministic_order():
    alert = build_safety_alert(
        ["refrigerant", "electrical"],
        "hinglish",
        approved=True,
    )
    assert alert.index("Kaam shuru karne se pehle") < alert.index("Koi bhi panel")
    assert alert.index("Koi bhi panel") < alert.index("Refrigerant line")
