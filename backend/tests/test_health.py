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


def test_health_returns_contract_payload():
    response = api_request("GET", "/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "ustaad-ai-api",
        "version": "0.1.0",
    }
    assert response.headers["x-request-id"]
