# Ustaad AI --- Dual Execution Plan

**Shared execution contract for Person A, Person B, and their AI coding
agents**\
**Project:** Ustaad AI · Build for Bharat (Scaler × Wispr Flow)\
**Plan version:** 1.0 · **Source pack reviewed:** `usTAAD AI.zip`\
**Working rule:** This document is the single shared source of truth.
Both people and both AI agents must read it before making changes.

------------------------------------------------------------------------

## 0. Mission and definition of done

Ustaad AI is a hands-free voice and camera co-pilot for Indian mechanics
and field technicians. The build is successful only when both golden
paths work on a real phone over live HTTPS, twice consecutively, with no
manual server-side intervention.

### Golden path 1 --- Diagnose

1.  Technician records a short Hindi/Hinglish fault description (maximum
    15 seconds).
2.  Technician may attach a photo of an error display, PCB, or breaker.
3.  Frontend sends WAV audio, optional JPEG, and language to the
    backend.
4.  Backend transcribes/interprets the input and returns a validated
    structured result.
5.  UI displays the deterministic safety alert first, then at most four
    steps, then the source for a grounded match.
6.  Spoken summary plays automatically when possible; replay is always
    available.
7.  Unknown/unverified codes are explicitly marked not grounded and
    receive only general, low-risk guidance.

### Golden path 2 --- Billing

1.  Technician records parts, quantities, prices, and labour.
2.  Backend extracts line items; application code calculates totals.
3.  Frontend displays editable rows and highlights missing/uncertain
    values.
4.  Technician confirms the bill.
5.  App generates WhatsApp text from confirmed values and opens the
    `wa.me` link.
6.  Recent bills are stored in browser `localStorage`.

### Non-negotiable product principles

-   Safety alert before repair steps, in both display order and spoken
    order.
-   Only verified knowledge-base entries can ground a diagnosis.
-   Model output is untrusted until schema-validated and checked against
    the KB.
-   Backend code, not the model, computes bill totals.
-   Missing/ambiguous prices are never guessed; they require
    confirmation.
-   The technician remains in control and confirms the bill before
    sharing.
-   Never claim latency, accuracy, or test performance that has not been
    measured.
-   Do not store uploaded audio or images on the server. Log request
    IDs, latency, and error codes only.

------------------------------------------------------------------------

## 1. Ownership model

The split is by **system boundary**, not by feature fragments. Each
person owns a coherent area and is responsible for its tests and
documentation. Shared contracts are agreed before parallel
implementation.

  ---------------------------------------------------------------------------------
  Area                    Person A --- Product,   Person B --- Backend, AI & domain
                          frontend & integration  logic lead
                          lead                    
  ----------------------- ----------------------- ---------------------------------
  Primary ownership       User experience and     API, model orchestration,
                          deployed client         grounding, safety, billing logic

  Main folder             `frontend/`             `backend/`

  Main deliverable        Mobile-first PWA with   Reliable FastAPI service
                          both user flows         implementing both flows

  Owns                    Recording, camera, UI   Upload handling, Gemini calls,
                          state machine,          schemas, KB loader, validator,
                          playback, bill editor,  safety layer, TTS endpoint, bill
                          WhatsApp handoff,       extraction/calculation, Render
                          localStorage, PWA,      
                          Vercel                  

  Tests                   Browser/device tests,   Unit/API tests,
                          interaction and         schema/grounding/safety/billing
                          end-to-end tests        tests

  Must not independently  API field names,        Frontend state/visual design,
  change                  response semantics,     browser-only UX choices
                          backend safety policy   

  Integration             Owns integration        Supplies stable API, test
  responsibility          branch, end-to-end      fixtures, deployment URL and
                          wiring and release      backend diagnostics
                          checklist               
  ---------------------------------------------------------------------------------

**Person A is the integration/release coordinator.** This does not mean
A owns B's implementation. B owns backend decisions inside the agreed
contract. A owns the integrated application and final release
coordination.

**Person B is the backend technical owner.** B must expose working
endpoints early, not wait until every model feature is complete.

------------------------------------------------------------------------

## 2. Person A --- detailed execution plan

### A0. First actions: establish the shared workspace

-   Create/confirm the project repository and agreed branch policy.
-   Create `frontend/` and reserve `backend/` for B.
-   Add this document as `EXECUTION_PLAN.md` at the repository root.
-   Add the API contract as `contracts/api-contract.md` (derive it from
    the agreed JSON examples and the decisions in section 5 below).
-   Create `.env.example` placeholders only; never commit secrets.
-   Confirm the Vercel project and obtain the backend base URL from B
    when available.
-   Create a shared integration branch and agree on small, descriptive
    commits.

### A1. Frontend foundation

Build with **Next.js App Router + Tailwind**, mobile-first and
thumb-friendly.

Implement: - Single-screen application with Diagnose and Bill tabs. -
`VoiceButton` - `CameraCapture` - `ReplyPlayer` - `SafetyBanner` -
`StepList` - `BillCard` - `TabBar` - `ErrorToast`

Use the blueprint's state machine: - `idle`: large mic, camera action,
tabs. - `recording`: pulsing mic and visible timer. - `uploading`:
progress hint. - `thinking`: transcript if available and spinner. -
`result`: safety alert, steps, replay. - `speaking`: replay state. -
`error`: short Hindi/English message and retry.

Do not let UI states become an improvised collection of booleans.
Implement and test explicit transitions.

### A2. Browser audio capture

-   Tap-to-toggle is the primary interaction; hold-to-talk is optional.
-   Maximum recording duration: 15 seconds with visible timer and
    auto-stop.
-   Capture through AudioWorklet where supported; downsample to 16 kHz
    mono and encode 16-bit PCM WAV in-browser.
-   Do not send WebM/MP4 and expect the backend to transcode it.
-   Use pointer events and `touch-action: none` for hold interaction;
    prevent accidental text selection/context menu only where needed.
-   Validate the produced WAV locally before sending it.
-   Show a clear retry state if permission is denied, recording fails,
    or the clip is empty/too large.

### A3. Camera capture

-   Use a rear-camera capture input (`accept="image/*"` and environment
    capture hint).
-   Resize on canvas to approximately 1024 px on the long side.
-   Export JPEG at approximately 0.8 quality.
-   Show a preview and allow retake/remove before upload.
-   Image is optional; diagnosis must still work without it.

### A4. Diagnose UI and response rendering

-   Submit `audio`, optional `image`, and `lang` to
    `POST /api/diagnose`.
-   Show transcript as soon as the response makes it available.
-   Render safety alert before all other advice.
-   Render no more than four concise steps.
-   Show source only when supplied by the backend.
-   Clearly distinguish grounded and not-grounded answers.
-   If `needs_confirmation` is true, display the confirmation question
    and do not present the uncertain code as confirmed.
-   Always display text even if TTS fails.

### A5. Speech playback

-   Integrate `POST /api/tts` using the agreed response format.
-   Auto-play spoken summary after diagnosis where browser policy
    permits.
-   Keep replay visible.
-   On the first user interaction, unlock audio on iOS if required.
-   If server TTS fails, fall back to browser `speechSynthesis`.
-   Never hide the text answer because audio failed.

### A6. Billing UI

-   Submit recorded audio and optional customer name to
    `POST /api/bill`.
-   Render editable rows: item name, quantity, unit price, kind
    (`part`/`labour`).
-   Highlight `needs_confirmation` rows.
-   Handle unsupported mentions such as discounts explicitly; do not
    silently apply them.
-   Recalculate totals in the UI only as a display convenience; backend
    remains authoritative for the submitted result.
-   If `total_complete` is false, show that the total is incomplete and
    block final WhatsApp sharing until missing values are confirmed.
-   After confirmation, generate/use backend-provided WhatsApp text or
    regenerate it from the confirmed rows according to the agreed
    contract.
-   Open `wa.me` with URL-encoded text; phone number is optional.
-   Store recent bills in `localStorage`; no server database.

### A7. PWA, accessibility and deployment

-   Add manifest, app name, icons, standalone display mode.
-   Verify Add to Home Screen on Android Chrome.
-   Minimum touch target: 56 px.
-   High contrast for sunlight; minimal text; no form-heavy main path.
-   Configure `NEXT_PUBLIC_API_URL`.
-   Call `/health` on load to wake backend.
-   Configure Vercel environment variables and deploy early.
-   Test deployed frontend against deployed backend on a physical phone,
    not just localhost.

### A8. Person A acceptance criteria

-   [ ] Mic starts/stops reliably; 15-second cap works.
-   [ ] Audio is valid 16 kHz mono PCM WAV.
-   [ ] Camera image is resized JPEG and optional.
-   [ ] Diagnose UI follows the explicit state machine.
-   [ ] Safety banner always appears before steps.
-   [ ] Unknown/unverified diagnosis is visibly ungrounded.
-   [ ] TTS failure does not remove text; browser voice fallback works.
-   [ ] Bill rows are editable and uncertain rows are highlighted.
-   [ ] Incomplete bills cannot be shared as final.
-   [ ] WhatsApp message is correctly encoded and opens.
-   [ ] PWA installs on Android Chrome.
-   [ ] Both flows work on a real phone against live HTTPS.

------------------------------------------------------------------------

## 3. Person B --- detailed execution plan

### B0. First actions: backend contract and service skeleton

-   Own `backend/`.
-   Read this plan and `contracts/api-contract.md` before implementing
    routes.
-   Build FastAPI skeleton immediately with `/health` and stub versions
    of all endpoints.
-   Deploy the skeleton to Render early so A can integrate against a
    real HTTPS service.
-   Publish the base URL and current deployment status to A.
-   Keep all secrets in Render environment variables; provide
    `.env.example`.

### B1. Backend structure

Use the blueprint's intended separation: - `main.py` --- routes and
request/response orchestration. - `config.py` --- environment, limits,
model name, provider configuration. - `schemas.py` --- Pydantic
request/response models. - `kb.py` --- load/index verified KB entries. -
`prompts.py` --- model instructions and prompt construction. -
`ai_service.py` --- Gemini calls. - `tts_service.py` --- chosen TTS
provider and fallback strategy. - `safety.py` --- deterministic safety
strings and tag mapping. - `billing.py` --- deterministic line
arithmetic and WhatsApp text. - `tests/` --- unit and API tests.

### B2. API and upload handling

Implement: - `POST /api/diagnose` --- multipart `audio` WAV, optional
JPEG `image`, `lang` (`hi` or `en`). - `POST /api/tts` --- text and
language; return audio bytes with correct content type. -
`POST /api/bill` --- multipart audio and optional `customer_name`. -
`GET /health` --- status response.

Validate: - WAV readability, channel count/sample rate where
practical. - Audio maximum around 2 MB. - Image maximum around 1.5 MB. -
Allowed MIME types and empty uploads. - Request timeout and model
timeout. - CORS restricted to the deployed Vercel origin. - Simple
per-IP rate limiting. - Consistent error response with `error_code` and
human-readable message.

### B3. Gemini integration

-   Use the current supported Gemini Flash model, selected through
    `GEMINI_MODEL`.
-   Confirm the exact model name and structured-output support in AI
    Studio; do not assume a model name from an old note.
-   Use the supported `google-genai` SDK.
-   Send audio and optional image with the relevant verified KB context.
-   Require structured JSON matching Pydantic schemas.
-   On invalid output, perform at most one controlled retry; then return
    `MODEL_BAD_OUTPUT`.
-   Treat every model field as untrusted input until validation
    completes.
-   Do not allow the model to invent sources, verified KB entries, or
    repair facts.

### B4. Knowledge base and grounding

-   Use `error_codes.draft.json` as the starting dataset; promote it to
    `backend/error_codes.json` only after review.
-   The KB is the single source of truth for fault-code facts.
-   Only `verified: true` entries may be passed to the model as
    grounding context.
-   Each entry must preserve ID, category, brand, model series, codes,
    meaning, probable causes, checks, safety tags, source references,
    verification state and checked date.
-   If a model returns a `kb_id`, confirm that it exists and is
    verified.
-   If not, force `grounded=false` and `kb_id=null`.
-   If grounded, overwrite meaning, causes, checks and source from the
    KB. Model phrasing must never change the facts.
-   Model-series caveat must remain visible: codes can differ by model
    series.
-   Do not promote unverified entries without checking the relevant
    official manufacturer source/model manual.

**Important existing KB cautions:** - The Voltas E6 candidate is
explicitly excluded because sources conflict and no official Voltas
source was found. Do not use it as a grounded demo. - Some LG and
Samsung entries are marked `verified: false`; they must not ground
answers. - The dataset's `verified: true` means the text was read on an
official manufacturer support page on the recorded date; it does not
prove applicability to every exact model. - The knowledge base currently
targets split AC only, with a target of 15--20 entries and 2--3 brands.

### B5. Deterministic safety layer

-   Implement `safety.py` using `safety_strings.draft.json` as a draft.
-   Map safety tags and category to hand-written warnings in Hindi and
    English (and Hinglish if retained in the contract).
-   Use the defined order: `general`, `electrical`, `high_voltage`,
    `refrigerant`, `moving_parts`, `water_drain`.
-   Ensure applicable warnings are composed deterministically and never
    removed by model output.
-   Safety alert must be first in the API result and first in spoken
    output.
-   Arrange Hindi/Hinglish review by a fluent speaker/technician before
    treating the strings as final.
-   Add tests that verify safety alert presence and ordering for every
    safety tag.

### B6. Billing extraction and deterministic arithmetic

-   Model extracts only: customer, item name, quantity, unit price,
    kind, `needs_confirmation`, and unsupported mentions as agreed.
-   Normalize spoken number expressions, including `dedh`, `dhai`,
    `saadhe`, Hindi numerals spoken as words, and mixed English/Hindi.
-   Code calculates each line total and grand total using integer
    rupees.
-   Missing or ambiguous price =\> `needs_confirmation=true`; never
    guess.
-   Discounts are not supported in the MVP; return them as unsupported
    mentions and do not silently subtract them.
-   If any required price is missing, `total_complete=false` and
    `total=null` (do not present a misleading partial total as final).
-   WhatsApp text is generated in code only from confirmed values.
-   No GST handling in MVP; receipt must say `(No GST included)`.

### B7. TTS

-   Run the Day 0/early spike to choose Gemini TTS or Sarvam.
-   Confirm that the selected provider works from Render and produces
    intelligible Hindi speech.
-   Keep provider configurable through environment variables.
-   Do not use `edge-tts` on Render; blueprint warns it is unofficial
    and may return 403 from cloud IPs.
-   If server TTS fails, return a typed `TTS_FAILED` response so A can
    use browser `speechSynthesis`.
-   Always preserve text as the fallback.

### B8. Hardening and deployment

-   Render start command:
    `uvicorn main:app --host 0.0.0.0 --port $PORT`.
-   Environment variables include `GEMINI_API_KEY`, `GEMINI_MODEL`,
    `TTS_PROVIDER` and provider key, `ALLOWED_ORIGIN`, `MAX_AUDIO_MB`,
    `MAX_IMAGE_MB`.
-   Hard model timeout around 20 seconds; one retry with backoff where
    appropriate.
-   Add keep-warm ping strategy; free Render instances may sleep and
    take around a minute to wake.
-   Never store audio/images.
-   Log request IDs, latency and error codes only.
-   Use a paid-tier model key with a budget cap/rate limit if the
    event's judging traffic requires it.
-   Ensure `.env.example` contains names but no values/secrets.

### B9. Person B acceptance criteria

-   [ ] `/health` is deployed and reachable over HTTPS.
-   [ ] All three POST endpoints have stable schemas and useful errors.
-   [ ] File size/type validation is enforced.
-   [ ] Only verified KB entries can ground responses.
-   [ ] Unknown/unverified codes always return `grounded=false`.
-   [ ] Grounded facts and source are overwritten from KB after model
    response.
-   [ ] Safety alert is deterministic and first.
-   [ ] Maximum four steps enforced.
-   [ ] Billing totals are calculated in code.
-   [ ] Missing prices require confirmation and prevent complete total.
-   [ ] Discounts/unsupported mentions are flagged, not silently
    applied.
-   [ ] TTS provider and fallback behavior are tested.
-   [ ] Backend tests cover all supplied test cases.
-   [ ] Render deployment is stable and secrets are not committed.

------------------------------------------------------------------------

## 4. Parallel workflow and integration cadence

### The rule: integrate early, integrate continuously

Do not work in isolation for a full day. Both people should have a
runnable version on Day 1.

  --------------------------------------------------------------------------------
  Phase             Person A works on Person B works on          Integration
                                                                 checkpoint
  ----------------- ----------------- -------------------------- -----------------
  Start / first     Repo, frontend    FastAPI skeleton,          Agree schemas and
  60--90 min        shell, state      `/health`, stub routes,    both URLs
                    machine, mock     Render deploy              
                    response UI                                  

  Phase 1           Audio capture and Upload validation and real A can send a WAV
                    upload against    Gemini                     and display a
                    stub              transcription/structured   stub/real
                                      response                   transcript

  Phase 2           Camera, diagnosis KB loader, grounding       One grounded and
                    rendering, TTS    validator, safety layer,   one out-of-KB
                    player            TTS                        diagnosis pass
                                                                 end-to-end

  Phase 3           Bill tab,         Billing extraction, number B01/B06/B08 pass
                    editable rows,    normalization,             through UI
                    WhatsApp UX       deterministic totals       

  Phase 4           PWA, errors,      Rate limit, timeouts,      Full regression
                    mobile polish,    logging, cold-start, API   on deployed phone
                    localStorage      tests                      

  Final gate        Demo flow,        Backend stability,         Both golden paths
                    README/deck       measured metrics, test     pass twice
                    screenshots,      report                     
                    release checklist                            
  --------------------------------------------------------------------------------

### Required sync points

1.  **Contract sync:** before either side implements real integration.
2.  **First deployment sync:** as soon as both `/health` and frontend
    shell are live.
3.  **Diagnose integration sync:** one known KB code and one unknown
    code.
4.  **Billing integration sync:** one normal bill, one missing-price
    bill, one discount case.
5.  **Feature freeze sync:** agree on cut list; no new features after
    freeze.
6.  **Submission sync:** verify links, repo, README, demo video, deck,
    and secrets.

### Daily operating rhythm

-   Start of work block: each person posts the one outcome they will
    deliver.
-   Mid-block: share blockers immediately; do not wait for the next
    meeting.
-   End of block: commit, push, report what works, what is broken, and
    the next dependency.
-   No unpushed "it works on my machine" features at integration
    checkpoints.
-   If a task crosses ownership boundaries, agree on the contract first;
    do not edit the other person's module directly without coordination.

------------------------------------------------------------------------

## 5. Shared API contract --- decisions that must be locked

The ZIP contains two related but non-identical contract descriptions: -
The PDF blueprint's initial contract lists the core diagnose and bill
fields. - `api_contract_examples.json` is a later `0.1` fixture contract
and adds `detected_code`, `needs_confirmation`, `confirm_question`,
`probable_causes`, `photo_note`, `provider`, `latency_ms`,
`unsupported_mentions`, and `total_complete`.

**Use the richer JSON fixture contract as the working starting point**,
while retaining the PDF's architecture and safety requirements. Person A
and B must review and freeze `contracts/api-contract.md` together before
real integration. Do not let either agent silently rename fields.

### Diagnose response --- minimum agreed shape

-   `transcript: string`
-   `detected_language: string`
-   `detected_code: string | null`
-   `grounded: boolean`
-   `kb_id: string | null`
-   `needs_confirmation: boolean`
-   `confirm_question: string | null`
-   `error_meaning: string | null`
-   `probable_causes: string[]`
-   `safety_alert: string`
-   `steps: string[]` (maximum 4)
-   `spoken_summary: string`
-   `source: string | null`
-   `photo_note: string | null` (only if image analysis adds a useful,
    cautious observation)
-   `provider: string` and `latency_ms: number` may be retained for
    diagnostics, but UI must not depend on them.

### Billing response --- minimum agreed shape

-   `customer: string | null`
-   `items: [{ name, qty, unit_price, kind, needs_confirmation }]`
-   `unsupported_mentions: string[]`
-   `total: integer | null`
-   `total_complete: boolean`
-   `whatsapp_text: string | null`
-   `provider` and `latency_ms` optional diagnostics.

### Error response

-   `error_code: string`
-   `message: string`

Known error codes from the blueprint: `AUDIO_TOO_LARGE`,
`AUDIO_UNREADABLE`, `MODEL_TIMEOUT`, `MODEL_BAD_OUTPUT`, `TTS_FAILED`,
`RATE_LIMITED`.

### Contract rules

-   Keep `POST /api/diagnose` multipart fields: `audio`, optional
    `image`, `lang`.
-   Keep `POST /api/bill` multipart fields: `audio`, optional
    `customer_name`.
-   Keep `/api/tts` request fields: `text`, `lang`; agree whether errors
    are JSON and success is raw audio bytes.
-   `total=null` when `total_complete=false`.
-   A `needs_confirmation` diagnosis must not be displayed as a
    confirmed code.
-   `safety_alert` must always exist; use general safety text even when
    not grounded.
-   `source` must be null when not grounded.
-   No API contract change without both owners agreeing and updating the
    contract document and fixtures.

------------------------------------------------------------------------

## 6. Test plan --- use the supplied datasets as acceptance tests

The ZIP includes: - `test_clips_diagnose.csv`: 15 rows (D01--D15), 3
out-of-KB rows (O01--O03), and 2 noisy cases (N01--N02). -
`test_clips_billing.csv`: 10 billing cases (B01--B10).

Do not only test happy paths. Preserve these expected behaviors.

### Diagnosis cases

-   LG CH05 / E0 alias handling and grounding: D01--D03.
-   LG CH38 / F4 alias handling: D04--D05.
-   LG CH61: D06.
-   LG indoor fan CH10 and outdoor fan EF: D07--D08.
-   LG CH54 after power event: D09.
-   LG CH04 drainage: D10.
-   Samsung C154, C1/21, 63, C1/54, C1/22: D11--D15.
-   Daikin U4, excluded Voltas E6, and compressor noise with no code
    must remain ungrounded: O01--O03.
-   Noisy speech and current-code precedence: N01--N02. In N02, answer
    the current CH61, not the earlier CH05.

**Important fixture review:** CSV expected values are test expectations,
not permission to invent a KB fact. If a test expects an alias/code
whose KB entry is not verified, the correct safe behavior is ungrounded
until the source is verified and the dataset is deliberately updated.

### Billing cases

-   B01: capacitor 250 + labour 300 = 550.
-   B02: gas top-up 1200 + labour 500 = 1700.
-   B03: wire 150 + switch 250 + labour 350 = 750; tests `dedh`, `dhai`,
    `saadhe`.
-   B04: PCB 2500 + labour 400 = 2900; mixed English numbers.
-   B05: two capacitors at 150 each + labour 200 = 500.
-   B06: contactor has missing price; flag it, never guess.
-   B07: extract customer name Sharma and calculate 1800 + 600 = 2400.
-   B08: flag discount 50 as unsupported; do not silently apply it.
-   B09: visit charge 300 + sensor 450 = 750.
-   B10: connector 80 + sensor 350 + gas 1000 + labour 700 = 2130.

### Pass criteria

-   Every verified in-KB case returns the correct KB ID.
-   Every out-of-KB case returns `grounded=false`, no invented source,
    and only low-risk general guidance.
-   Safety alert exists and appears first in every diagnosis.
-   Bill totals match hand calculations after user edits.
-   Missing prices never become guessed values.
-   Record actual test counts and failures; do not report unrun tests as
    passed.

### Synthetic audio generator

`make_synthetic_clips.py` creates synthetic Gemini-TTS speech and
optional noisy variants from the CSVs. It is explicitly test tooling and
should remain outside the hackathon repo/output path unless the team
decides otherwise. Synthetic speech is useful for pipeline/matching
regression, but it is not a substitute for recordings from real
technicians and must not be used to claim real-world accuracy. Run
`--dry-run` for placeholders; real generation requires `GEMINI_API_KEY`
and a confirmed `GEMINI_TTS_MODEL`.

------------------------------------------------------------------------

## 7. Timeline and gates

The source blueprint defines: - Day 0 preparation: 22--26 Nov. - Day 1
walking skeleton: 27 Nov. - Day 2 grounding, vision, billing: 28 Nov. -
Day 3 harden and ship: 29 Nov.

The team is now two people, but the gates remain.

### Gate 1 --- walking skeleton

-   Frontend and backend both deployed.
-   Physical phone reaches backend over HTTPS.
-   WAV recording → `/api/diagnose` → visible text works.
-   `/health` works and cold-start behavior is understood.

### Gate 2 --- both golden paths

-   Camera upload and KB grounding work.
-   Validator and deterministic safety work.
-   Billing extraction, editable rows, totals and WhatsApp share work.
-   Full supplied test set has been run at least once and failures
    logged.

### Gate 3 --- ship

-   Feature freeze.
-   Error states, retries, keep-warm and PWA install checked.
-   Sunlight and noise tests run.
-   Top failures fixed.
-   Latency measured on 4G and reported honestly.
-   Two-minute demo recorded; backup video available.
-   README, `.env.example`, deck and submission links verified.

### Cut list if behind schedule

Drop in this order: 1. Stretch language. 2. Recent bills list. 3. Camera
input on Path B (if added) and animation polish. 4. Replay/TTS fallback
polish.

**Never cut:** deterministic safety layer, KB validation, editable bill.

------------------------------------------------------------------------

## 8. Git, files and collaboration rules

### Repository layout

``` text
/
├── EXECUTION_PLAN.md
├── README.md
├── contracts/
│   └── api-contract.md
├── frontend/                 # Person A owns
│   ├── app/
│   ├── components/
│   └── ...
├── backend/                  # Person B owns
│   ├── main.py
│   ├── config.py
│   ├── schemas.py
│   ├── kb.py
│   ├── prompts.py
│   ├── ai_service.py
│   ├── tts_service.py
│   ├── safety.py
│   ├── billing.py
│   └── tests/
├── test-data/
│   ├── test_clips_diagnose.csv
│   └── test_clips_billing.csv
└── .env.example
```

### Branching

-   `main` is always deployable.
-   Person A: `feat/frontend-*`.
-   Person B: `feat/backend-*`.
-   Integration: `integrate/*` or a shared integration branch.
-   Small commits with clear messages.
-   Use normal merge commits unless the team agrees otherwise.
-   No secrets, real customer audio, or private credentials in Git.
-   Each owner reviews changes touching their owned folder.
-   Contract changes require explicit review from both.

### Commit / handoff format

Every handoff message must include: 1. What changed. 2. Files changed.
3. How to run it. 4. Tests run and exact result. 5. Known failures or
limitations. 6. What the other person can integrate next.

------------------------------------------------------------------------

## 9. AI-agent operating instructions --- mandatory for both agents

Paste the following instruction into each AI coding agent's project
context. Both agents must read the root `EXECUTION_PLAN.md` first.

### Shared agent instruction

> You are contributing to Ustaad AI. Before editing anything, read the
> complete root `EXECUTION_PLAN.md` and the API contract. Treat them as
> the source of truth. Do not invent requirements or silently change API
> fields, safety rules, KB facts, or scope.
>
> You must work only in your assigned ownership area unless the owner
> explicitly authorizes a cross-boundary change: - Person A's agent:
> `frontend/` and frontend documentation/tests. - Person B's agent:
> `backend/` and backend documentation/tests.
>
> Before coding, report: (1) your understanding of the assigned
> deliverable, (2) files you intend to create/change, (3) dependencies
> on the other person, and (4) the smallest testable milestone.
>
> Build in small increments. Do not create a large unreviewed code dump.
> After each milestone, run the relevant tests and report exact commands
> and results. Never claim a test passed unless it was run.
>
> The API contract is shared. If a change is necessary, explain why and
> propose the exact contract diff; wait for both human owners to approve
> it before changing implementation.
>
> Treat model output as untrusted. Never let Gemini invent a verified
> fault-code fact, source, safety warning, or bill total. Follow KB
> validation, deterministic safety, and code-based arithmetic.
>
> Do not commit secrets, store uploaded audio/images, add a
> database/auth system, or expand beyond the MVP without explicit
> approval.
>
> At handoff, provide changed files, run instructions, test evidence,
> known issues, and the next integration step. Keep the root execution
> plan updated only through a jointly approved change.

### Person A agent's first task

> Read `EXECUTION_PLAN.md` and `contracts/api-contract.md`. Inspect the
> existing repository before editing. Scaffold the mobile-first Next.js
> App Router + Tailwind UI, implement the explicit UI state machine and
> component shells, and use typed mock responses until B's endpoints are
> ready. Do not invent backend response fields. Deliver a runnable
> frontend and a short report of the integration points B must satisfy.

### Person B agent's first task

> Read `EXECUTION_PLAN.md` and `contracts/api-contract.md`. Inspect the
> existing repository before editing. Scaffold FastAPI, Pydantic
> schemas, `/health`, and stub routes matching the frozen contract;
> deploy the skeleton to Render immediately. Then implement upload
> validation and backend tests before adding Gemini. Preserve the
> verified-only KB rule, deterministic safety layer, and code-based
> billing arithmetic. Deliver a live base URL and sample
> request/response fixtures for A.

------------------------------------------------------------------------

## 10. Human decision log --- resolve before real integration

These are real ambiguities or open decisions in the source pack. Do not
let either AI agent decide them silently.

  -----------------------------------------------------------------------
  Decision                Owner(s)                Required resolution
  ----------------------- ----------------------- -----------------------
  Exact Gemini Flash      B proposes; A approves  Verify in AI Studio and
  model name and          product impact          set `GEMINI_MODEL`
  structured output                               
  support                                         

  TTS provider: Gemini    B tests; A              Choose based on
  TTS or Sarvam           listens/approves UX     intelligibility and
                                                  Render compatibility

  Hindi speech output:    Both                    Test both; retain the
  Devanagari or Roman                             clearer result
  Hinglish input to TTS                           

  Contract fixture vs     Both                    Freeze richer
  PDF's simpler contract                          fixture-based contract,
                                                  with explicit field
                                                  definitions

  `lang` values and       Both                    PDF says `hi` or `en`,
  Hinglish support                                but product targets
                                                  Hindi/Hinglish; decide
                                                  exact accepted values

  TTS success/error       B proposes; A           Raw audio bytes +
  response format         integrates              content type on
                                                  success; typed JSON
                                                  error

  `photo_note` semantics  Both                    Optional cautious
                                                  observation; never use
                                                  photo alone to
                                                  fabricate a code

  Diagnosis confirmation  Both                    Define whether user
  flow                                            confirms code in UI
                                                  then resubmits, or
                                                  backend returns a
                                                  question state

  KB promotion and review B owns data pipeline;   Confirm each
                          both review             entry/source and
                                                  model-series caveat

  Hosting details         A frontend, B backend   Vercel + Render per
                                                  blueprint; pitch deck's
                                                  Railway mention is an
                                                  inconsistency to
                                                  resolve in favour of
                                                  the blueprint unless
                                                  the team explicitly
                                                  chooses otherwise
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 11. Risk register

  -----------------------------------------------------------------------
  Risk                                Mitigation / owner
  ----------------------------------- -----------------------------------
  Incorrect fault-code facts          B: verified-only KB, post-model
                                      validator, source from KB

  Unsafe repair advice                B: deterministic safety first; A:
                                      preserve first-position
                                      display/playback

  Speech recognition errors in noisy  Both: noisy test clips,
  settings                            retry/confirmation UI, never
                                      silently confirm uncertain codes

  Misheard prices                     B: `needs_confirmation`; A:
                                      editable highlighted rows

  Incomplete bill appears final       B: `total_complete=false`,
                                      `total=null`; A: block final share

  Gemini model or quota changes       B: environment-configured model,
                                      timeout/rate limit/budget cap

  TTS unavailable                     B: provider test and typed failure;
                                      A: browser speech fallback

  Render cold start                   B: keep-warm strategy; A: health
                                      ping and visible wait state

  Integration drift                   Both: frozen contract, shared
                                      fixtures, early deployed
                                      integration

  Scope creep                         Both: preserve two golden paths and
                                      cut list
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 12. Definition of final handoff

The project is not complete when code is merely written. It is complete
when the team can demonstrate and hand over:

-   [ ] Public repository with clean README and architecture
    explanation.
-   [ ] `.env.example` with no secrets.
-   [ ] Live Vercel frontend and Render backend.
-   [ ] `/health` endpoint reachable.
-   [ ] Both golden paths pass twice on a physical phone.
-   [ ] Test report for all 15 diagnosis and 10 billing CSV cases,
    including failures.
-   [ ] Safety review of Hindi/Hinglish strings.
-   [ ] No server-side persistence of audio or images.
-   [ ] Measured latency and test pass counts only.
-   [ ] Two-minute demo plus backup video.
-   [ ] Final deck with real screenshots and honest metrics.
-   [ ] QR code/live link tested from a second device.

------------------------------------------------------------------------

## 13. First 90-minute execution checklist

### Person A

-   [ ] Read this document fully.
-   [ ] Create/confirm repository and add this file at root.
-   [ ] Scaffold Next.js + Tailwind app in `frontend/`.
-   [ ] Build one-screen shell, tabs, mic/camera controls, and explicit
    UI states.
-   [ ] Create typed mock diagnose and billing response fixtures from
    the agreed contract.
-   [ ] Deploy the frontend shell to Vercel.
-   [ ] Send B the frontend URL and the exact API integration
    requirements.

### Person B

-   [ ] Read this document fully.
-   [ ] Scaffold FastAPI in `backend/`.
-   [ ] Implement `/health` and stub `/api/diagnose`, `/api/tts`,
    `/api/bill`.
-   [ ] Add Pydantic schemas matching the frozen contract.
-   [ ] Deploy backend skeleton to Render.
-   [ ] Send A the base URL, sample curl commands, and response
    fixtures.
-   [ ] Begin upload validation and unit tests.

### Together

-   [ ] Freeze `contracts/api-contract.md`.
-   [ ] Verify both deployed URLs from a phone.
-   [ ] Choose Gemini model and TTS spike owners/results.
-   [ ] Agree the next integration checkpoint and exact time.

------------------------------------------------------------------------

## 14. Source-pack inventory and interpretation

This plan was derived from the supplied ZIP, which contains:

1.  `Ustaad AI — Workflow and Implementation Blueprint.pdf` --- 10
    pages; product flows, architecture, API, KB, prompts, safety,
    frontend/backend implementation, schedule, tests, risks and
    submission.
2.  `Ustaad-AI-Pitch-Deck.pptx` --- 9 slides; problem, solution,
    architecture, trust/safety, scope, voice-first workflow, schedule
    and impact.
3.  `api_contract_examples.json` --- contract version 0.1 examples and
    contract changes.
4.  `error_codes.draft.json` --- split-AC knowledge-base draft with 16
    entries and an excluded Voltas E6 candidate.
5.  `safety_strings.draft.json` --- draft
    general/electrical/high-voltage/refrigerant/moving-parts/water-drain
    warnings in English, Hindi and Hinglish.
6.  `test_clips_diagnose.csv` --- diagnosis, out-of-KB and noisy test
    cases.
7.  `test_clips_billing.csv` --- 10 spoken billing test cases.
8.  `make_synthetic_clips.py` --- Gemini-TTS synthetic audio generator
    and manifest writer.

### Source discrepancies worth remembering

-   Blueprint says Vercel + Render; pitch deck architecture slide
    mentions Render/Railway. This plan follows the blueprint's Vercel +
    Render deployment unless both owners explicitly change it.
-   Blueprint's first-pass API list is simpler than the later `0.1` JSON
    fixture. This plan uses the richer fixture as the starting point and
    requires a joint contract freeze.
-   Blueprint says the build was solo; this plan adds ownership
    boundaries, branch rules, agent instructions and integration
    checkpoints without changing the product's two-path scope.
-   The JSON KB contains unverified entries and an explicitly excluded
    Voltas E6. Neither can be used as grounded facts until properly
    verified.
-   Draft safety strings require human language/technician review before
    final use.
