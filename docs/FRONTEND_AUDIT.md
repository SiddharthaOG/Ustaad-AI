# Ustaad AI — Frontend and Integration Audit

Audit updated: 27 November 2026
Repository: `SiddharthaOG/Ustaad-AI`
Current integration branch: `main`

## Integration status

All six frontend feature slices have been merged into `main` using normal merge commits:

1. PR #5 — `feat/frontend-api-client`
2. PR #6 — `feat/diagnosis-completion`
3. PR #7 — `feat/billing-workflow`
4. PR #8 — `feat/media-validation-alignment`
5. PR #9 — `feat/frontend-quality`
6. PR #10 — `test/frontend-integration`

The FastAPI B0 foundation was subsequently merged in PR #11. No squash or rebase merges were used.

## Frontend feature audit

### Diagnosis

- Diagnosis submission uses the central API client and frozen multipart contract.
- Optional JPEG image preview, replacement and removal are implemented.
- JPEG extension, MIME type, 1.5 MiB size, start/end markers and browser decoding (where `createImageBitmap` is available) are checked.
- Diagnosis audio must be PCM16 mono 16 kHz WAV, at most 2 MiB and 15 seconds.
- WAV parsing checks RIFF/WAVE length, format and data chunks, codec, sample rate, channels, bit depth, byte rate, block alignment and complete sample frames.
- Retry reuses the current recording; clear resets the diagnosis and media.
- Demo scenarios cover verified fault + safety warning, unverified result, clarification, no fault code, backend failure and simulated timeout.
- Incomplete responses are normalized defensively. A missing KB ID forces an unverified result. Repair steps are withheld for ungrounded results and while clarification is required. Steps are capped at four.
- Safety alerts are rendered before causes and repair steps.

### Billing

- Voice recording and strict PCM WAV upload are supported.
- The real extraction path calls `POST /api/bill`.
- Extracted part/labour rows are editable; rows can be added and removed.
- Missing prices remain null and require explicit confirmation. Incomplete rows are not silently assigned guessed quantity, unit or type values.
- Browser estimates are explicitly provisional. The production total and WhatsApp text must come from `POST /api/bill/confirm`.
- A separate, explicitly labelled demo path simulates extraction and confirmation for frontend testing. Its arithmetic is not the production source of truth.
- WhatsApp sharing is enabled only when the confirmation response is complete and contains server-generated text.
- Up to 10 recent bill drafts are saved in localStorage. Audio and image bytes are not stored there.

### Media validation

- Diagnosis and Billing share the same strict WAV validator.
- Audio and image constraints are aligned with the MVP contract.
- The validator rejects malformed/truncated RIFF data, unsupported codecs, stereo, wrong sample rates, partial PCM frames, extension/MIME mismatches and oversize files.
- JPEG validation includes a browser decode attempt when supported.
- The backend must repeat all media validation; browser checks are not a security boundary.

### Workflow quality

- Diagnosis and Billing remain mounted while switching modes, preserving each workflow's draft state.
- The inactive recorder is stopped; requesting microphone permission is cancelled when switching away.
- Diagnosis requests are abortable. Submission guards prevent duplicate requests and stale responses from replacing newer state.
- Billing extraction is guarded against duplicate submission; editor controls are locked while extraction or confirmation is in progress.
- Loading, error, incomplete, success and confirmation states are represented.
- Keyboard tab navigation, visible focus, reduced-motion handling and responsive CSS rules are included.
- The workspace status reports that backend integration is pending rather than claiming the backend is operational.

### API integration tests

- The API client is tested with mocked fetch responses for health, diagnosis, bill extraction, bill confirmation and TTS.
- Tests verify multipart fields and browser-managed multipart boundaries, JSON bodies, TTS Blob responses, structured API errors, non-JSON errors, network failures, timeouts, caller cancellation and malformed success JSON.
- TTS caller cancellation is distinguished from timeout.

## Verification

### Local frontend verification

On the complete frontend integration branch:

- `npm test`: all five suites passed (audio, media, diagnosis, billing and API client).
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; `/`, `/signup` and `/workspace` were prerendered.
- `git diff --check`: passed.
- Production route smoke test: `GET /` and `GET /workspace` both returned HTTP 200.

### GitHub Actions

- Frontend CI for PR #10 completed successfully (run #18), including the expanded test suite.
- Backend CI for PR #11 completed successfully on Python 3.11 and Python 3.14.

## Backend status after B0

The FastAPI foundation is merged in PR #11:

- `GET /health` returns the expected service payload.
- `POST /api/diagnose`, `POST /api/bill`, `POST /api/bill/confirm` and `POST /api/tts` exist as explicit 503 stubs.
- Pydantic request/response contracts, request IDs, standardized error envelopes, safe validation details and configurable CORS are in place.
- Local backend tests: 20 passed.
- A live local Uvicorn smoke test passed.
- The actual frontend API client reached `/health` and sent multipart requests to the diagnosis and billing stubs; it correctly parsed their standardized 503 responses.

**Not implemented yet:** real media decoding/validation, Gemini extraction, verified KB grounding, deterministic safety policy, bill extraction, server-side Decimal confirmation and TTS.

## Integration limits still open

- No real AI diagnosis or extraction has been tested.
- No production KB has been activated. Source-pack KB and safety files are drafts; unverified entries must remain excluded. The Hindi strings in the draft safety file were observed to be garbled in the current local read, so they must not be used as-is.
- Backend media validation and file-size enforcement are still pending.
- Actual server-side Decimal arithmetic and WhatsApp message generation are pending.
- Diagnosis TTS playback UI is not connected.
- Browser microphone permission, capture, playback and JPEG decoding need manual testing on target Android/desktop browsers.
- Visual QA at 360 px, 390 px, tablet and desktop has not been completed in a real browser session.
- WhatsApp handoff has not been tested on a device with WhatsApp installed.
- Render/Vercel services and deployments have not been created.

## Branch history and cleanup

- `frontend` is retained as the original frontend development-history branch.
- `feat/audio-pipeline` is retained as the audio implementation-history branch.
- The six frontend feature branches are retained as development history after merging.
- `feat/frontend-main` was deleted after confirming it pointed to the same commit as `frontend`, while that commit was already behind and contained in `main`.
- The local `feat/frontend-workspace` history branch is preserved.
- PR #1 remains closed without merge; PR #2 and #3 are merged; PR #4 was closed without merge; PRs #5–#11 are merged.

## Next implementation order

1. Backend B1: strict in-memory media validation and decoding.
2. Diagnosis structured extraction, verified-only KB grounding and deterministic safety.
3. Billing extraction and server-side Decimal confirmation.
4. One TTS provider or documented 503 fallback.
5. Real frontend/backend integration and device QA.
6. Render/Vercel deployment only after both golden paths work safely.
