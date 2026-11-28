# Ustaad AI — Backend

FastAPI service for Ustaad AI, a voice-first diagnostic and billing co-pilot for AC mechanics and field technicians.

This branch delivers the **media-validation and diagnosis pipeline (B1/B2)**. Billing extraction and bill confirmation remain a separate workstream and are intentionally not implemented here.

## Capability status

| Capability | Status | Notes |
|---|---|---|
| Health check | Ready | `GET /health` |
| Audio upload validation | Ready | PCM16, mono, 16 kHz WAV; 15-second / 2 MiB limits |
| Optional photo validation | Ready | JPEG; 1.5 MiB upload limit; decoded, oriented, resized and re-encoded in memory |
| Diagnosis extraction | Ready | Gemini structured extraction from audio; optional image is observation-only |
| Verified knowledge grounding | Ready | Runtime admits only verified entries with an official manufacturer source |
| Safety handling | Ready with conservative defaults | Deterministic warnings; draft translations are opt-in and disabled by default |
| Speech synthesis | Implemented; provider validation ongoing | Dedicated Gemini TTS model; returns WAV |
| Billing extraction | Not implemented | `POST /api/bill` returns a structured 503 response |
| Bill confirmation | Not implemented | `POST /api/bill/confirm` returns a structured 503 response |

## Architecture and trust boundaries

1. **Gemini interprets; it does not authorise facts.** The model transcribes speech and extracts a candidate manufacturer/code. It is not asked to supply fault meanings, causes, repair instructions or citations.
2. **The backend grounds diagnosis.** A candidate must be supported by the transcript, pass the confidence/confirmation gate and match a verified knowledge-base entry scoped to the manufacturer. Unknown or unverified codes are never presented as grounded.
3. **Images cannot establish fault codes.** The image may contribute a cautious physical observation only. Code selection and knowledge-base lookup are based on audio/transcript and manufacturer scope.
4. **Safety is deterministic.** Conservative safety messages remain active. Draft localized safety strings are used only when `SAFETY_STRINGS_APPROVED=true`; high-risk repair steps remain withheld until approval.
5. **Uploads stay in memory.** Audio and image bytes are validated and passed to the provider without being written to application storage. Do not add request-body, transcript, image or credential logging.
6. **Provider failures are bounded.** Gemini requests use a finite timeout/retry budget, transient-error classification and safe client-facing error envelopes.

## API

All endpoints are served by the FastAPI application.

| Method | Path | Input | Current behaviour |
|---|---|---|---|
| `GET` | `/health` | — | Service status and version |
| `POST` | `/api/diagnose` | Multipart: `audio` (required WAV), `image` (optional JPEG), `lang` (optional: `hi`, `hinglish`, `en`) | Extracts transcript/code, validates and grounds diagnosis |
| `POST` | `/api/tts` | JSON: `{ "text": "...", "lang": "hinglish" }` | Generates a WAV speech response using the configured Gemini TTS model |
| `POST` | `/api/bill` | Multipart: `audio`, `lang`, optional `customer_name` | Validates audio, then returns 503 until billing extraction is integrated |
| `POST` | `/api/bill/confirm` | JSON bill draft | Returns 503 until authoritative Decimal confirmation is integrated |

Interactive API documentation is available at `/docs` when the service is running.

### Diagnosis response guarantees

- `grounded=true` is returned only when a supported candidate matches the verified knowledge base.
- Ambiguous, conflicting, unsupported or insufficiently confident candidates request clarification or remain explicitly ungrounded.
- Unverified codes do not receive model-generated fault meanings, causes or repair steps.
- Safety warnings are included independently of whether a code is grounded.
- `source` is taken from the matched knowledge-base entry, never invented by the model.
- `photo_note` is restricted to cautious physical observations; it cannot ground a code.

### Error envelope

Errors use a consistent shape containing `error.code`, `error.message`, `error.request_id` and optional `error.details`. The request identifier is also returned in the `X-Request-ID` response header. Submitted values are not echoed in validation errors.

## Knowledge base

The runtime dataset is versioned in `backend/data/error_codes.json`. The loader currently admits entries only when all of the following are true:

- The entry is explicitly marked `verified: true`.
- The category is supported by this MVP.
- The manufacturer is in the supported allowlist (currently LG and Samsung).
- At least one source belongs to that manufacturer's official domain.
- The source has a review date and the required entry fields are present.

The current dataset contains 16 candidate entries; **13 pass the runtime verification filters**. Unverified entries remain in the file for traceability but are not used for grounding. Brand-scoped lookup prevents a code from one manufacturer being applied to another.

The safety-language draft is stored separately at `backend/data/safety_strings.draft.json`. It is not enabled by default.

## Requirements

- Python 3.11+
- A Gemini API key for live diagnosis and TTS requests
- Internet access from the backend process to the Gemini API

The automated test suite uses mocked provider responses and does not require a live API key.

## Local setup (PowerShell)

Run these commands from the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements-dev.txt
Copy-Item backend\.env.example backend\.env
```

Set `GEMINI_API_KEY` in `backend/.env`. Never commit the real `.env` file or share its contents.

Start the API:

```powershell
uvicorn app.main:app --app-dir backend --env-file backend/.env --reload --host 127.0.0.1 --port 8000
```

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Open the API schema at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Configuration

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | unset | Required for live diagnosis and TTS |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Structured audio/image interpretation model |
| `GEMINI_TIMEOUT_SECONDS` | `45` | Bounded provider request budget (clamped by application) |
| `GEMINI_TTS_MODEL` | `gemini-3.8-flash-lite-tts` | Dedicated speech-generation model |
| `GEMINI_TTS_VOICE` | `Kore` | Prebuilt TTS voice |
| `SAFETY_STRINGS_APPROVED` | `false` | Enables draft localized safety strings only after human review |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed browser origins |
| `SERVICE_VERSION` | `0.1.0` | Version returned by health endpoint |

For production, set secrets in the hosting provider's environment configuration. Set `CORS_ORIGINS` to the exact deployed frontend origin(s); do not use a wildcard.

## Media validation limits

| Media | Accepted format | Limits and processing |
|---|---|---|
| Audio | RIFF/WAVE, uncompressed PCM16, mono, 16 kHz | Maximum 15 seconds and 2 MiB; complete RIFF/chunk/sample validation |
| Optional image | JPEG only | Maximum 1.5 MiB and 20 megapixels; EXIF orientation applied, converted to RGB, resized to fit 1024×1024, metadata stripped and re-encoded |

Uploads are read in bounded chunks. Invalid media is rejected before provider calls.

## Tests and CI

From the repository root, install the development/test dependencies and run:

```powershell
python -m pip install -r backend\requirements-dev.txt
python -m compileall -q backend\app backend\tests
python -m pytest -q backend\tests
```

The GitHub Actions workflow runs the backend compilation and pytest suite on Python **3.11 and 3.14** for backend pull requests and relevant pushes to `main`.

Ruff is not currently configured in this repository; CI does not claim a Ruff check. If linting is added later, it should be pinned/configured and run in the same workflow rather than treated as an informal local-only check.

## Billing integration contract

Billing is intentionally outside this branch. When the billing workstream is ready, it should reuse the shared provider and media boundary rather than create duplicate clients or validators:

- `get_gemini_provider(request)` — process-scoped Gemini provider.
- `validate_audio_upload(upload)` — shared server-side audio validation.
- `provider.transcribe_audio(validated_audio, language)` — shared plain transcription.
- `provider.generate_structured(contents, response_model)` — shared structured extraction.

Billing confirmation must remain server-authoritative and use Python `Decimal`. Missing prices must require confirmation; totals and WhatsApp receipts must not be produced for incomplete bills. Those behaviours are not implemented by this branch.

## Explicit MVP limitations

- No authentication, database, persistent audio/image storage, Redis or background queue.
- Billing extraction and confirmation are not implemented here.
- TTS is implemented against Gemini but still requires broader human pronunciation, latency, reliability and cost evaluation against Sarvam.
- The current verified knowledge base covers only the included LG and Samsung entries. Unsupported brands/codes must remain ungrounded.
- Draft localized safety translations are not approved by default.


## Docker

The repository root `docker-compose.yml` builds and runs this API alongside the Next.js frontend. Configure `backend/.env` from `.env.example`, then run `docker compose up --build` from the repository root. The API listens on `0.0.0.0:8000` inside the container; `/health` is used for the Compose health check.
