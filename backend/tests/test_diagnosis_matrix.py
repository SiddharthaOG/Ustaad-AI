import asyncio
import json
from types import SimpleNamespace

import pytest
from google.genai import errors

from backend.app.diagnosis_models import DiagnosisExtraction
from backend.app.knowledge import KnowledgeBase
from backend.app.media import ValidatedAudio, ValidatedImage
from backend.app.services.diagnosis import diagnose


class FakeProvider:
    def __init__(self, extraction):
        self.extraction = extraction

    async def extract_diagnosis(self, audio, image, language):
        return self.extraction


def make_extraction(transcript, brand, code, confidence=0.99, needs_confirmation=False, photo_note=None):
    return DiagnosisExtraction(
        transcript=transcript,
        brand=brand,
        detected_code=code,
        code_confidence=confidence,
        needs_confirmation=needs_confirmation,
        photo_note=photo_note,
    )


CASES = [
    ("LG verified CH05", "LG AC me CH05 aa raha hai", "LG", "CH05", 0.99, False, True, False, "lg-ch05"),
    ("LG verified CH38", "LG AC me CH38 aa raha hai", "LG", "CH38", 0.99, False, True, False, "lg-ch38"),
    ("LG verified alias E0", "LG AC me E0 blink kar raha hai", "LG", "E0", 0.99, False, True, False, "lg-ch05"),
    ("LG verified alias F4", "LG AC me F4 aa raha hai", "LG", "F4", 0.99, False, True, False, "lg-ch38"),
    ("LG unverified CH90", "LG AC me CH90 aa raha hai", "LG", "CH90", 0.99, False, False, False, None),
    ("LG verified CH61", "LG AC me CH61 dikha raha hai", "LG", "CH61", 0.99, False, True, False, "lg-ch61"),
    ("LG verified CH10", "LG AC me CH10 dikha raha hai", "LG", "CH10", 0.99, False, True, False, "lg-ch10"),
    ("LG verified EF", "LG AC me EF aa raha hai", "LG", "EF", 0.99, False, True, False, "lg-ch67"),
    ("LG verified CH54", "LG AC me CH54 aa raha hai", "LG", "CH54", 0.99, False, True, False, "lg-ch54"),
    ("LG verified CH04", "LG AC me CH04 aa raha hai", "LG", "CH04", 0.99, False, True, False, "lg-ch04"),
    ("Samsung verified C154", "Samsung AC me C154 aa raha hai", "Samsung", "C154", 0.99, False, True, False, "samsung-c154"),
    ("Samsung slash code", "Samsung AC me C1 aur 21 blink kar raha hai", "Samsung", "C1/21", 0.99, False, True, False, "samsung-21"),
    ("Samsung verified 63", "Samsung AC me 63 dikha raha hai", "Samsung", "63", 0.99, False, True, False, "samsung-63"),
    ("Samsung slash 54", "Samsung AC me C1 aur 54 blink kar raha hai", "Samsung", "C1/54", 0.99, False, True, False, "samsung-54"),
    ("Samsung slash 22", "Samsung AC me C1 aur 22 blink kar raha hai", "Samsung", "C1/22", 0.99, False, True, False, "samsung-22"),
    ("Unsupported Daikin U4", "Daikin AC me U4 aa raha hai", "Daikin", "U4", 0.99, False, False, False, None),
    ("Unsupported Voltas E6", "Voltas AC me E6 aa raha hai", "Voltas", "E6", 0.99, False, False, False, None),
    ("Symptoms without code", "AC compressor se ajeeb awaaz aa rahi hai", "LG", None, 0.0, True, False, True, None),
    ("Earlier CH05, current CH61", "Pehle CH05 aaya tha, ab CH61 dikha raha hai", "LG", "CH61", 0.99, False, True, False, "lg-ch61"),
    ("Model picked earlier code", "Pehle CH05 aaya tha, ab CH61 dikha raha hai", "LG", "CH05", 0.99, False, False, True, None),
    ("Incorrectly spoken digits", "LG AC me CH zero five aa raha hai", "LG", "CH06", 0.99, False, False, True, None),
    ("Hindi spoken digits", "LG AC mein CH shunya paanch aa raha hai", "LG", "CH05", 0.99, False, True, False, "lg-ch05"),
    ("Missing brand", "AC me CH05 aa raha hai", None, "CH05", 0.99, False, False, True, None),
    ("Missing code", "LG AC display par error blink kar raha hai", "LG", None, 0.0, True, False, True, None),
    ("Low-confidence code", "LG AC me CH05 aa raha hai", "LG", "CH05", 0.52, False, False, True, None),
    ("Ambiguous spoken code", "LG AC me CH05 ya CH61 aa raha hai", "LG", "CH05", 0.55, True, False, True, None),
    ("Image-only code must not ground", "LG AC display par error hai", "LG", "CH05", 0.99, False, False, True, None),
    ("Wrong manufacturer scope", "Samsung AC me C154 aa raha hai", "LG", "C154", 0.99, False, False, True, None),
    ("Transcript recovers missing brand field", "LG AC me CH05 aa raha hai", None, "CH05", 0.99, False, True, False, "lg-ch05"),
    ("Conflicting transcript and extracted brand", "LG AC me CH05 aa raha hai", "Samsung", "CH05", 0.99, False, False, True, None),
    ("Multiple brands mentioned", "LG ya Samsung AC me CH05 aa raha hai", "LG", "CH05", 0.99, False, False, True, None),
]


@pytest.mark.parametrize(
    "case_id,transcript,brand,code,confidence,needs_confirmation,grounded,confirm,kb_id",
    CASES,
    ids=[case[0] for case in CASES],
)
def test_predeclared_diagnosis_matrix(
    case_id, transcript, brand, code, confidence, needs_confirmation, grounded, confirm, kb_id
):
    extraction = make_extraction(transcript, brand, code, confidence, needs_confirmation)
    result = asyncio.run(
        diagnose(
            audio=ValidatedAudio(data=b"wav", duration_seconds=1.0),
            image=None,
            language="hinglish",
            provider=FakeProvider(extraction),
            knowledge_base=KnowledgeBase.load(),
        )
    )
    assert result.grounded is grounded, case_id
    assert result.needs_confirmation is confirm, case_id
    assert result.kb_id == kb_id, case_id
    if not grounded:
        assert result.error_meaning is None
        assert result.source is None


def test_image_note_is_not_used_to_ground_a_code_absent_from_audio():
    extraction = make_extraction(
        "LG AC display par error hai",
        "LG",
        "CH05",
        photo_note="The display appears to show CH05.",
    )
    image = ValidatedImage(original_size=100, width=320, height=240, data=b"jpeg")
    result = asyncio.run(
        diagnose(
            audio=ValidatedAudio(data=b"wav", duration_seconds=1.0),
            image=image,
            language="hinglish",
            provider=FakeProvider(extraction),
            knowledge_base=KnowledgeBase.load(),
        )
    )
    assert result.grounded is False
    assert result.needs_confirmation is True
    assert result.kb_id is None
