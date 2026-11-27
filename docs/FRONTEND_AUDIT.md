# Ustaad AI Frontend Audit

Audit date: 27 November 2026
Scope: frontend completion, frozen API integration contracts, media validation, workflow resilience and automated tests.

## Feature branch stack

These branches are intentionally stacked so each later branch contains the earlier work. Integrate them in this order if/when the team authorizes it:

1. feat/frontend-api-client (existing API client and diagnosis foundation)
2. feat/diagnosis-completion
3. feat/billing-workflow
4. feat/media-validation-alignment
5. feat/frontend-quality
6. test/frontend-integration

All work remains unmerged. No pull requests were opened, nothing was merged into main, and no services were deployed. The architecture Markdown file in the local project root remains untracked and was not included in any commit.

## Feature audit

### Diagnosis

- Diagnosis submission uses the central API client and frozen multipart contract.
- Optional JPEG image preview, replacement and removal are implemented.
- JPEG extension, MIME type, 1.5 MiB size, start/end markers and browser decoding (where createImageBitmap is available) are checked.
- Diagnosis audio must be a PCM16 mono 16 kHz WAV, at most 2 MiB and 15 seconds.
- WAV parsing checks RIFF/WAVE length, format and data chunks, codec, sample rate, channels, bit depth, byte rate, block alignment and complete sample frames.
- Retry reuses the current recording; clear resets the diagnosis and media.
- Demo scenarios cover verified fault + safety warning, unverified result, clarification, no fault code, backend failure and simulated timeout.
- Incomplete responses are normalized defensively. A missing KB ID forces an unverified result. Repair steps are withheld for ungrounded results and while clarification is required. Steps are capped at four.
- Safety alerts are rendered before causes and repair steps.

### Billing

- Voice recording and strict PCM WAV upload are supported.
- The real extraction path calls POST /api/bill.
- Extracted part/labour rows are editable; rows can be added and removed.
- Missing prices remain null and require explicit confirmation. Incomplete rows are not silently assigned guessed quantity, unit or type values.
- Browser estimates are explicitly provisional. The production total and WhatsApp text must come from POST /api/bill/confirm.
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
- The workspace status now reports that backend integration is pending rather than claiming the backend is operational.

### API integration tests

- The API client is tested with mocked fetch responses for health, diagnosis, bill extraction, bill confirmation and TTS.
- Tests verify multipart fields and browser-managed multipart boundaries, JSON bodies, TTS Blob responses, structured API errors, non-JSON errors, network failures, timeouts, caller cancellation and malformed success JSON.
- TTS caller cancellation is distinguished from timeout.

## Verification performed

The final local verification run on the stacked integration branch passed:

- npm test: all five suites passed (audio, media, diagnosis, billing and API client).
- npm run lint: passed.
- npx tsc --noEmit: passed.
- npm run build: passed; /, /signup and /workspace were prerendered.
- git diff --check: passed.
- Production smoke test: GET / and GET /workspace both returned HTTP 200.

The frontend CI workflow now runs npm test rather than only the audio tests. GitHub Actions was not triggered for these branch pushes because the workflow runs on pull requests or pushes to main; no pull request was opened, consistent with the no-merge instruction.

## Integration limits - not yet verified

These are important and must not be described as complete:

- Person B's backend is not implemented yet. No real /health, /api/diagnose, /api/bill or /api/bill/confirm endpoint was available during this audit.
- API tests use mocked fetch responses. They verify the client contract, not a live frontend-to-FastAPI exchange.
- Actual model diagnosis accuracy, KB grounding against the deployed KB, extraction accuracy, backend Decimal arithmetic and server-side media validation remain pending.
- Browser microphone permission, capture, audio playback and JPEG decoding should be manually tested on target Android/desktop browsers. The production HTTP smoke test is not an interactive UI test.
- Visual QA at 360 px, 390 px, tablet and desktop has not been performed in a real browser session. Responsive CSS and breakpoints are present, but that is not equivalent to viewport-by-viewport visual verification.
- WhatsApp handoff has not been tested on a device with WhatsApp installed.
- TTS API client behaviour is tested, but diagnosis TTS playback UI is not connected.
- Render/Vercel services and deployments have not been created.

## Integration recommendation

Keep the current branch stack unmerged until Person B supplies the backend skeleton. Then test /health and /api/diagnose against the actual FastAPI service, followed by /api/bill and /api/bill/confirm. Only after those contract tests pass should the team authorize integration into main and deployment.
