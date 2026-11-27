import asyncio

import httpx

from backend.app.main import app


def api_request(method: str, path: str, **kwargs):
    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(send())


def assert_not_ready(response, operation: str):
    assert response.status_code == 503
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "MODEL_ERROR"
    assert body["error"]["request_id"] == response.headers["x-request-id"]
    assert body["error"]["details"]["operation"] == operation
    assert "not implemented yet" in body["error"]["message"]


def test_diagnosis_route_accepts_multipart_contract_and_returns_stub():
    response = api_request(
        "POST",
        "/api/diagnose",
        data={"lang": "hinglish"},
        files={"audio": ("sample.wav", b"placeholder", "audio/wav")},
    )
    assert_not_ready(response, "diagnosis")


def test_bill_extraction_route_accepts_multipart_contract_and_returns_stub():
    response = api_request(
        "POST",
        "/api/bill",
        data={"lang": "hi", "customer_name": "Ramesh"},
        files={"audio": ("sample.wav", b"placeholder", "audio/wav")},
    )
    assert_not_ready(response, "bill extraction")


def test_bill_confirmation_route_accepts_json_contract_and_returns_stub():
    response = api_request(
        "POST",
        "/api/bill/confirm",
        json={
            "customer": "Ramesh",
            "items": [
                {
                    "name": "Capacitor",
                    "qty": "1",
                    "unit": "piece",
                    "unit_price": "250.00",
                    "kind": "part",
                }
            ],
            "unsupported_mentions": [],
        },
    )
    assert_not_ready(response, "bill confirmation")


def test_tts_route_accepts_json_contract_and_returns_stub():
    response = api_request(
        "POST",
        "/api/tts",
        json={"text": "Pehle main MCB band karein.", "lang": "hinglish"},
    )
    assert_not_ready(response, "text-to-speech")


def test_invalid_confirmation_is_standardized_without_echoing_input():
    response = api_request(
        "POST",
        "/api/bill/confirm",
        json={
            "customer": "PRIVATE CUSTOMER",
            "items": [
                {
                    "name": "Capacitor",
                    "qty": "-1",
                    "unit": "piece",
                    "unit_price": "250.00",
                    "kind": "part",
                }
            ],
            "unsupported_mentions": [],
        },
    )

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "INVALID_REQUEST"
    assert error["request_id"] == response.headers["x-request-id"]
    assert "PRIVATE CUSTOMER" not in response.text
