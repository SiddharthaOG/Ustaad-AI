import pytest
from pydantic import ValidationError

from backend.app.schemas import BillItemDraft, TtsRequest


def item(**overrides):
    values = {
        "name": "Capacitor",
        "qty": "1",
        "unit": "piece",
        "unit_price": "250.00",
        "kind": "part",
    }
    values.update(overrides)
    return BillItemDraft(**values)


def test_bill_item_normalizes_decimal_strings():
    parsed = item(qty="0.125", unit_price="249.5")
    assert parsed.qty == "0.125"
    assert parsed.unit_price == "249.50"


@pytest.mark.parametrize("quantity", ["0", "-1", "NaN", "Infinity", "1.2345", "9" * 21])
def test_bill_item_rejects_invalid_quantities(quantity):
    with pytest.raises(ValidationError):
        item(qty=quantity)


@pytest.mark.parametrize("price", ["-1", "NaN", "Infinity", "1.234", "9" * 13])
def test_bill_item_rejects_invalid_prices(price):
    with pytest.raises(ValidationError):
        item(unit_price=price)


def test_missing_price_is_representable_for_confirmation_flow():
    parsed = item(unit_price=None)
    assert parsed.unit_price is None


def test_tts_text_is_trimmed_and_language_is_constrained():
    parsed = TtsRequest(text="  Namaste  ", lang="hi")
    assert parsed.text == "Namaste"
    with pytest.raises(ValidationError):
        TtsRequest(text="   ")
    with pytest.raises(ValidationError):
        TtsRequest(text="Namaste", lang="te")
