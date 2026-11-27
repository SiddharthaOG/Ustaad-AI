# Ustaad AI — Hackathon Implementation Architecture v2

**Event:** Scaler × Wispr Flow hackathon  
**Target:** Both golden paths working on deployed HTTPS by 29 November. 30 November is contingency/submission buffer.  
**Authority:** This document is the backend implementation contract. It supersedes conflicting endpoint/schema suggestions in older notes. Source-pack examples remain useful regression fixtures.

## 1. Mission and non-negotiable rules

Ustaad AI is a voice-first diagnostic and billing co-pilot for Indian mechanics and field technicians.

**Golden path A — Diagnose:** Hindi/Hinglish voice (max 15 sec) + optional equipment photo → interpretation → verified KB match or explicit unknown → deterministic safety warning → max four safe steps → spoken summary.

**Golden path B — Billing:** spoken job description → parts/labour extraction → editable rows → confirmation → deterministic total → WhatsApp-ready text.

Rules:
- Gemini interprets and extracts. It is never authoritative for repair facts, safety policy, prices, or arithmetic.
- `grounded=true` only when backend matches an approved `verified=true` KB entry.
- Unknown/ambiguous/unverified faults must not receive invented causes or repair steps.
- Deterministic safety warning must appear and be spoken before repair instructions.
- Missing/ambiguous prices are never guessed; they block finalization and WhatsApp generation.
- No GST or discounts. Report discount/tax requests in `unsupported_mentions`; do not apply them.
- Python `Decimal`, never model output or float arithmetic, computes money.
- Do not persist uploaded audio/images. Do not log transcripts, names, phone numbers, raw bodies, media or secrets.
- No auth, database, Redis, accounts, extra languages, vector DB, or non-essential redesign in this sprint.
- Never claim tests/deployment passed unless actually run/verified.

**Definition of done:** both flows work twice consecutively on a real phone against deployed HTTPS, with safe unknown-diagnosis and incomplete-bill behavior demonstrated.

## 2. Technology and architecture

| Layer | Required implementation |
|---|---|
| Frontend | Existing Next.js App Router, TypeScript, Tailwind; Person A owns it |
| Backend | Python 3.11+, FastAPI, Pydantic v2; Person B owns it |
| LLM | Gemini via `google-genai` |
| Diagnosis grounding | Curated, version-controlled JSON KB; exact/normalized brand + category + code matching |
| Billing | Python `Decimal` |
| TTS | Choose one provider after a short Hindi/Hinglish smoke test: Gemini TTS or Sarvam |
| Hosting | Vercel frontend, Render backend |

Do not build vector search/RAG infrastructure. Load a small approved KB JSON file into memory. Process media in memory only.

Request flow: Browser capture → FastAPI validation/decoding → Gemini structured interpretation/extraction → Pydantic validation → deterministic grounding/safety or billing arithmetic → contract-compliant response.

## 3. Backend folder structure

Person B owns only `backend/`. Keep route handlers thin.

```text
backend/
  app/
    __init__.py
    main.py
    config.py
    schemas.py
    services/
      ai_service.py
      media.py
      diagnosis.py
      safety.py
      billing.py
      tts.py
    knowledge/
      error_codes.json
      safety_strings.json
    tests/
      test_health.py
      test_media.py
      test_diagnosis.py
      test_grounding.py
      test_safety.py
      test_billing.py
      test_tts.py
  requirements.txt
  .env.example
  README.md
```

Use environment variables for Gemini key/model, TTS configuration, CORS origins and limits. Never commit credentials.

## 4. Frozen API contract

Base prefix: `/api`. Do not rename fields or change semantics without coordinating with Person A and updating this document plus frontend types.

### 4.1 GET /health

HTTP 200:
```json
{"status":"ok","service":"ustaad-ai-api","version":"0.1.0"}
```
Do not expose secrets or environment dumps.

### 4.2 POST /api/diagnose

Content type: `multipart/form-data`.

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `audio` | file | yes | WAV only, max 2 MB, PCM16, mono, 16 kHz expected |
| `image` | file | no | JPEG only, max 1.5 MB, must decode |
| `lang` | string | no | `hi`, `hinglish`, `en`; default `hinglish` |

Success response — preserve these field names from `source-pack/api_contract_examples.json`:

```json
{
  "transcript": "LG AC pe CH05 error aa raha hai",
  "detected_code": "CH05",
  "kb_id": "lg-ch05",
  "grounded": true,
  "needs_confirmation": false,
  "confirm_question": null,
  "error_meaning": "Communication problem between indoor and outdoor units",
  "probable_causes": ["Temporary communication or power error"],
  "safety_alert": "Koi bhi panel kholne ya taar chhune se pehle main MCB band karein.",
  "steps": ["Breaker band karke 5 minute rukein, phir power chalu karein."],
  "spoken_summary": "Pehle main MCB band karein. Phir jaanch karein.",
  "source": "LG India - Guide to Error Codes",
  "photo_note": null,
  "provider": "gemini",
  "latency_ms": 1234
}
```

Semantics:
- `kb_id`, `grounded`, `source`, `error_meaning`, `probable_causes`, and `steps` are backend-owned, not trusted from Gemini.
- `grounded=true` only if exact approved KB entry has `verified=true`.
- `source` is a source-title string only for grounded results; otherwise null. Keep the source-pack string shape for compatibility.
- Unknown response: `grounded=false`, `kb_id=null`, `source=null`, `error_meaning=null`, `probable_causes=[]`, `steps=[]`; use general safety alert and safe spoken explanation.
- If brand/code is ambiguous, set `needs_confirmation=true`, supply `confirm_question`, and leave diagnosis facts/steps empty.
- Never exceed four steps.
- Safety is always present and is the first part of `spoken_summary`.
- `latency_ms` must be measured, never hardcoded.
- Photo may provide context but cannot turn an unverified code into a grounded diagnosis.

### 4.3 POST /api/bill

Content type: `multipart/form-data`.

| Field | Type | Required | Constraint |
|---|---|---:|---|
| `audio` | file | yes | WAV, max 2 MB, validate/decode |
| `lang` | string | no | `hi`, `hinglish`, `en` |
| `customer_name` | string | no | max 80 chars; never log |

Response:
```json
{
  "transcript": "Ek capacitor 250 ka aur labour 300",
  "customer": null,
  "items": [
    {"name":"Capacitor","qty":"1","unit":"piece","unit_price":"250.00","kind":"part","needs_confirmation":false},
    {"name":"Labour","qty":"1","unit":"job","unit_price":"300.00","kind":"labour","needs_confirmation":false}
  ],
  "unsupported_mentions": [],
  "total": "550.00",
  "total_complete": true,
  "whatsapp_text": "Ustaad AI Bill\nCapacitor x1 piece: Rs 250.00\nLabour x1 job: Rs 300.00\nTotal: Rs 550.00\n(No GST included)",
  "provider": "gemini",
  "latency_ms": 1234
}
```

Item fields: `name` (trimmed, max 100 chars), `qty` (positive decimal string), `unit` (e.g. piece/metre/hour/job), `unit_price` (decimal string or null), `kind` (`part` or `labour`), `needs_confirmation` (boolean). Money uses decimal strings with two decimal places. Quantity max three decimal places.

If a price or required value is missing/ambiguous, mark the row `needs_confirmation=true`, return `total=null`, `total_complete=false`, `whatsapp_text=null`. Never guess prices. Do not apply discounts or GST; list them in `unsupported_mentions`.

### 4.4 POST /api/bill/confirm

JSON request; frontend sends edited rows. Client totals are never trusted.

```json
{
  "customer": null,
  "items": [
    {"name":"Capacitor","qty":"1","unit":"piece","unit_price":"250.00","kind":"part"},
    {"name":"Labour","qty":"1","unit":"job","unit_price":"300.00","kind":"labour"}
  ],
  "unsupported_mentions": []
}
```

Success:
```json
{
  "items": [
    {"name":"Capacitor","qty":"1","unit":"piece","unit_price":"250.00","kind":"part","line_total":"250.00","needs_confirmation":false},
    {"name":"Labour","qty":"1","unit":"job","unit_price":"300.00","kind":"labour","line_total":"300.00","needs_confirmation":false}
  ],
  "subtotal": "550.00",
  "total": "550.00",
  "total_complete": true,
  "whatsapp_text": "Ustaad AI Bill\nCapacitor x1 piece: Rs 250.00\nLabour x1 job: Rs 300.00\nTotal: Rs 550.00\n(No GST included)"
}
```

Recalculate all line totals and total using Decimal. Ignore client-supplied totals. If any row is incomplete/invalid, return HTTP 200 with `total=null`, `total_complete=false`, `whatsapp_text=null` and row-level confirmation flags. Only generate WhatsApp text for a complete confirmed bill.

### 4.5 POST /api/tts

JSON:
```json
{"text":"Pehle main MCB band karein. Phir jaanch karein.","lang":"hinglish"}
```
Max text length 1200 chars. Return binary playable audio with accurate `Content-Type` (e.g. audio/mpeg or audio/wav). Choose one provider only. No server-side persistence. If TTS blocks delivery, return documented 503 and let frontend use browser speech synthesis; do not block diagnosis.

### 4.6 Common error envelope

All non-2xx errors:
```json
{
  "error": {
    "code": "AUDIO_INVALID",
    "message": "Audio file could not be read. Please record again.",
    "request_id": "uuid",
    "details": null
  }
}
```

Codes: 400 `INVALID_REQUEST`; 413 `FILE_TOO_LARGE`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `AUDIO_INVALID` / `IMAGE_INVALID`; 429 `RATE_LIMITED`; 502 `MODEL_ERROR`; 504 `MODEL_TIMEOUT`; 500 `INTERNAL_ERROR`. Never return stack traces or provider secrets.

## 5. Exact backend behavior

### Media validation — P0
- Enforce size while reading, not only Content-Length.
- Validate actual bytes and decode; MIME/extension alone is insufficient.
- WAV must be PCM16, mono, 16 kHz for current browser pipeline; reject empty, malformed, truncated, unsupported codec.
- JPEG must decode; reject invalid images and unreasonable dimensions.
- Process in memory, close buffers promptly, do not write uploads to disk/cloud.
- Test valid, empty, truncated, wrong signature/codec and oversized files.

### Gemini structured output — P0
- Use `google-genai`; key/model from environment.
- Request structured JSON matching internal Pydantic models.
- Treat all model output as untrusted; validate types, enums, lengths and ranges.
- Retry malformed output at most once; then return safe typed error.
- Model must not generate authoritative KB facts/source, safety policy, or bill totals.
- No chain-of-thought output.

### Diagnosis grounding — P0
1. Normalize brand/category/code.
2. Match only `verified=true` entries from curated `error_codes.json`.
3. Require sufficient context; ask brand/model clarification for collisions.
4. Backend overwrites all diagnosis facts and source from the matched KB entry.
5. No match means ungrounded with null facts/source and empty causes/steps.
6. Do not activate unverified entries. Explicitly exclude conflicting Voltas E6 mapping in source pack.
7. Photo cannot independently establish a verified code.

### Deterministic safety — P0
- Map KB `safety_tags` to reviewed strings in `safety_strings.json`.
- Always include general safety. Add applicable tags in this order: general, electrical, high_voltage, refrigerant, moving_parts, water_drain.
- Safety alert always present; missing tag mapping falls back to general safety.
- Spoken summary starts with the safety alert. Model cannot remove/reorder it.
- No hazardous electrical, capacitor, refrigerant, or moving-part repair instructions. Direct specialist work to qualified technicians.
- Source-pack safety strings are draft: inspect before activation.

### Billing — P0
- Gemini extracts only item names, quantities, units, explicitly spoken prices, kind and uncertainty.
- Use `Decimal` for every multiplication and sum; document rounding (two decimal places).
- Missing/ambiguous values set confirmation flag and make bill incomplete.
- No inferred market prices. No discounts or GST.
- Confirmation endpoint revalidates and recalculates from scratch.
- Sanitize/cap customer and item strings. WhatsApp output is plain text.

### CORS, timeout, rate limiting — P0/P1
- CORS allows local dev and actual deployed Vercel origin only.
- Set provider timeout; map timeout to 504.
- Basic per-IP rate limiting only if fast and reliable; no Redis. Defer if it threatens core delivery.
- Keep secrets in Render env vars and placeholders in `.env.example`.

## 6. Priority matrix

**P0 — must be complete first**
1. FastAPI local + Render skeleton, health endpoint.
2. Pydantic schemas and error envelope.
3. Strict upload validation.
4. Diagnose endpoint with Gemini structured extraction.
5. Verified KB grounding and safe unknown behavior.
6. Deterministic safety, warning first, max four steps.
7. Bill extraction endpoint.
8. Bill confirmation endpoint with Decimal arithmetic.
9. Tests for media, grounding, safety, missing prices and arithmetic.
10. Deploy backend early for frontend integration.

**P1 — after P0**
1. One TTS provider returning playable bytes.
2. Image-aware diagnosis context.
3. Hindi/Hinglish normalization and clarification refinement.
4. Production CORS, bounded timeouts and basic abuse controls.

**P2 — only if both golden paths are stable**
Extra providers, broader KB, analytics, advanced optimization, infrastructure extras. If P1/P2 threatens P0 or 29 November release, defer it.

## 7. Person B execution phases and deliverables

### B0 — first 60–90 minutes: skeleton
Must create:
- FastAPI app with `GET /health` and stubs for all four API operations.
- Pydantic models in `schemas.py`.
- `requirements.txt`, `.env.example`, short README.
- Local run command, health check and curl example for each endpoint.
- Render skeleton deployment as early as possible.

Deliver working code, not another plan. Do not spend more than 90 minutes scaffolding.

### B1 — Diagnose vertical slice
- Validate/decode uploads.
- Gemini structured extraction.
- Match one approved verified KB entry first, then remaining verified entries.
- Deterministic safety.
- Grounded, unknown and clarification responses.
- Tests for LG CH05, unknown Daikin U4, ambiguous E6, and unverified entry exclusion.

### B2 — Billing vertical slice
- Gemini item extraction.
- Pydantic validation.
- Decimal calculations.
- Missing-price behavior.
- Confirmation endpoint and WhatsApp message generation.
- Tests for totals, missing price, zero/negative quantity, malformed money and discount mention.

### B3 — TTS and deploy hardening
- One provider or documented 503 fallback.
- CORS, timeouts, env docs.
- Render deployment and verified health URL.

## 8. Required working manner and progress report

For every task, the coding agent must:
1. Inspect repository and existing code before editing.
2. State task, priority and exact files to create/change.
3. Implement one vertical slice only; no speculative abstractions.
4. Run tests and endpoint smoke checks immediately.
5. Review contract drift, safety, grounding, arithmetic, secrets, logs and persistence.
6. Commit one coherent change with a conventional message.
7. Report completion and next task.

Use this exact report:

```text
TASK:
PRIORITY: P0 / P1 / P2
FILES CREATED:
FILES MODIFIED:
IMPLEMENTATION:
COMMANDS RUN:
TEST RESULTS:
CONTRACT DEVIATIONS:
SECURITY / SAFETY CHECK:
COMMIT:
DEPLOYMENT URL / STATUS:
REMAINING:
NEXT TASK:
```

Never claim a test passed unless it ran. Never claim deployed until live URL is checked. If blocked, state the blocker and proceed with the next independent P0 task.

## 9. Backend acceptance checklist

- [ ] Health endpoint returns expected JSON.
- [ ] Valid WAV/JPEG accepted; empty, oversized, truncated, malformed and wrong codec rejected.
- [ ] LG CH05 returns backend-grounded KB data.
- [ ] Daikin U4 returns unknown, no invented facts/steps.
- [ ] Ambiguous E6 asks clarification; does not guess.
- [ ] Unverified KB entries never used.
- [ ] Safety warning always present and first in spoken summary.
- [ ] At most four repair steps.
- [ ] Bill extraction never invents prices.
- [ ] Missing price yields null total, incomplete flag and null WhatsApp text.
- [ ] Confirmation recomputes totals server-side using Decimal.
- [ ] Invalid quantity/money rejected.
- [ ] Discount is reported but not applied.
- [ ] TTS returns playable audio or documented fallback.
- [ ] Timeout maps correctly.
- [ ] No media persistence or private-content logging.
- [ ] Backend is deployed and health URL verified.

## 10. Explicitly out of scope

Authentication, accounts, database, Redis, cloud storage, background workers, server-side media history, GST, discounts, payments, inventory, new languages, vector DB/embeddings, multi-provider orchestration, extensive analytics, extensive redesign, 3D/complex animations.

## 11. Team rules

- Person A owns frontend, integration, contract coordination and release.
- Person B owns backend and backend tests.
- Backend should publish a working stub immediately; frontend must not wait for full AI completion.
- Do not change endpoint names/fields/semantics/limits unilaterally.
- Work in small feature branches and PRs to `main`; CI before merge.
- Normal merge commits only; never squash or rebase.
- Integrate continuously, not on the final day.

**Final instruction:** build the smallest safe, complete, testable implementation of both golden paths. Correctness and demo reliability outrank feature breadth.
