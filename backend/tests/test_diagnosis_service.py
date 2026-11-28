import asyncio

from backend.app.diagnosis_models import DiagnosisExtraction
from backend.app.knowledge import KnowledgeBase
from backend.app.media import ValidatedAudio, ValidatedImage
from backend.app.services.diagnosis import diagnose


class FakeProvider:
    def __init__(self, extraction):
        self.extraction = extraction

    async def extract_diagnosis(self, audio, image, language):
        return self.extraction


def run(extraction, *, image=None, language="hinglish", safety_approved=False):
    return asyncio.run(
        diagnose(
            audio=ValidatedAudio(data=b"wav", duration_seconds=1.0),
            image=image,
            language=language,
            provider=FakeProvider(extraction),
            knowledge_base=KnowledgeBase.load(),
            safety_approved=safety_approved,
        )
    )


def extraction(**overrides):
    values = {
        "transcript": "LG AC me CH05 aa raha hai",
        "brand": "LG",
        "detected_code": "CH05",
        "code_confidence": 0.99,
        "needs_confirmation": False,
        "photo_note": None,
    }
    values.update(overrides)
    return DiagnosisExtraction(**values)


def test_verified_lg_code_is_grounded_from_backend_kb():
    result = run(extraction())
    assert result.grounded is True
    assert result.kb_id == "lg-ch05"
    assert result.error_meaning
    assert result.source.startswith("LG India")
    assert len(result.steps) <= 4
    assert result.safety_alert


def test_low_confidence_code_requires_confirmation_and_withholds_facts():
    result = run(extraction(code_confidence=0.45))
    assert result.grounded is False
    assert result.needs_confirmation is True
    assert result.confirm_question
    assert result.kb_id is None
    assert result.error_meaning is None
    assert result.steps == []
    assert result.source is None


def test_missing_brand_requires_brand_confirmation_even_if_code_matches():
    result = run(extraction(brand=None, transcript="AC me CH05 aa raha hai"))
    assert result.needs_confirmation is True
    assert "brand" in result.confirm_question.lower()


def test_missing_code_requires_code_confirmation():
    result = run(extraction(detected_code=None))
    assert result.needs_confirmation is True
    assert "code" in result.confirm_question.lower()


def test_model_code_not_present_in_transcript_requires_confirmation():
    result = run(
        extraction(
            transcript="LG AC me CH61 aa raha hai",
            detected_code="CH05",
        )
    )
    assert result.needs_confirmation is True
    assert result.grounded is False
    assert result.kb_id is None


def test_spoken_digit_code_is_supported_by_transcript():
    result = run(
        extraction(
            transcript="LG AC me CH zero five aa raha hai",
            detected_code="CH05",
        )
    )
    assert result.grounded is True
    assert result.kb_id == "lg-ch05"


def test_spoken_tens_code_is_supported_by_transcript():
    result = run(
        extraction(
            transcript="LG AC me CH sixty one aa raha hai",
            detected_code="CH61",
        )
    )
    assert result.grounded is True
    assert result.kb_id == "lg-ch61"


def test_voltas_e6_does_not_borrow_lg_e6_meaning():
    result = run(extraction(transcript="Voltas AC me E6 aa raha hai", brand="Voltas", detected_code="E6"))
    assert result.grounded is False
    assert result.kb_id is None
    assert result.error_meaning is None
    assert result.source is None
    assert result.steps


def test_unverified_lg_code_is_not_grounded():
    result = run(extraction(detected_code="CH90"))
    assert result.grounded is False
    assert result.kb_id is None
    assert result.error_meaning is None
    assert result.source is None


def test_samsung_short_code_alias_uses_samsung_entry():
    result = run(
        extraction(
            transcript="Samsung AC C1 aur 21 blink kar raha hai",
            brand="Samsung",
            detected_code="21",
        )
    )
    assert result.grounded is True
    assert result.kb_id == "samsung-21"


def test_photo_note_is_ignored_without_an_uploaded_image():
    result = run(extraction(photo_note="Water is visible below the indoor unit."))
    assert result.photo_note is None


def test_photo_note_is_returned_only_when_image_was_supplied():
    image = ValidatedImage(original_size=100, width=320, height=240, data=b"jpeg")
    result = run(extraction(photo_note="Water is visible below the indoor unit."), image=image)
    assert result.photo_note == "Water is visible below the indoor unit."


def test_high_risk_fault_withholds_repair_steps_until_safety_strings_approved():
    result = run(
        extraction(
            detected_code="CH38",
            transcript="LG AC me CH38 aa raha hai",
        )
    )
    assert result.grounded is True
    assert result.kb_id == "lg-ch38"
    assert result.steps == []
    assert "trained technician" in result.safety_alert.lower()


def test_high_risk_steps_are_available_after_safety_approval():
    result = run(
        extraction(
            detected_code="CH38",
            transcript="LG AC me CH38 aa raha hai",
        ),
        safety_approved=True,
    )
    assert result.grounded is True
    assert result.steps


def test_current_code_takes_precedence_over_earlier_code_in_transcript():
    result = run(
        extraction(
            transcript="Pehle CH zero five aaya tha, ab CH sixty one dikha raha hai",
            detected_code="CH61",
        )
    )
    assert result.grounded is True
    assert result.kb_id == "lg-ch61"


def test_model_cannot_ground_an_earlier_code_when_a_later_code_is_spoken():
    result = run(
        extraction(
            transcript="Pehle CH zero five aaya tha, ab CH sixty one dikha raha hai",
            detected_code="CH05",
        )
    )
    assert result.grounded is False
    assert result.needs_confirmation is True
    assert result.kb_id is None
    assert result.confirm_question


def test_photo_note_rejects_fault_code_read_from_image():
    image = ValidatedImage(original_size=100, width=320, height=240, data=b"jpeg")
    result = run(
        extraction(photo_note="The display appears to show CH05."),
        image=image,
    )
    assert result.photo_note is None


def test_photo_note_rejects_diagnostic_claims():
    image = ValidatedImage(original_size=100, width=320, height=240, data=b"jpeg")
    result = run(
        extraction(photo_note="The compressor is likely faulty."),
        image=image,
    )
    assert result.photo_note is None


def test_photo_note_keeps_cautious_physical_observation():
    image = ValidatedImage(original_size=100, width=320, height=240, data=b"jpeg")
    result = run(
        extraction(photo_note="Water is visible below the indoor unit."),
        image=image,
    )
    assert result.photo_note == "Water is visible below the indoor unit."
