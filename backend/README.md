# Ustaad AI Backend

FastAPI backend for the Ustaad AI voice-first diagnostic and billing co-pilot.

## Current status — B0 foundation

- `GET /health` is implemented.
- `POST /api/diagnose`, `POST /api/bill`, `POST /api/bill/confirm` and `POST /api/tts` expose the frozen request contracts and return a standardized 503 stub response.
- Pydantic request/response contracts are defined.
- Request IDs, standardized error envelopes and configurable CORS are in place.
- AI, media processing, KB grounding, safety logic, Decimal confirmation and TTS are **not implemented yet**.

## Requirements

Python 3.11 or newer and pip.

## Local setup (PowerShell)

From the repository root:

```powershell
py -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
uvicorn app.main:app --app-dir backend --env-file backend/.env --reload --host 127.0.0.1 --port 8000
```

The `--env-file` option loads `backend/.env` through Uvicorn. The application itself reads only process environment variables. Do not add real credentials to Git.

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Interactive API schema: http://127.0.0.1:8000/docs

## Tests

```powershell
pip install -r backend\requirements.txt
pytest -q backend\tests
```

## Frozen endpoints

| Method | Path | Current B0 behavior |
|---|---|---|
| GET | `/health` | Returns service status/version |
| POST | `/api/diagnose` | Contract stub (503) |
| POST | `/api/bill` | Contract stub (503) |
| POST | `/api/bill/confirm` | Contract stub (503) |
| POST | `/api/tts` | Contract stub (503) |

All error responses use `error.code`, `message`, `request_id` and `details`. Request validation does not echo submitted values.

## Next implementation slices

1. Strict in-memory media validation and decoding.
2. Diagnosis structured extraction, verified-only KB grounding and deterministic safety.
3. Billing extraction and server-side Decimal confirmation.
4. One TTS provider or documented 503 fallback.
