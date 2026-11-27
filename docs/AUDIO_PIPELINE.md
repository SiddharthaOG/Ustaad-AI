# Browser Audio and Media Pipeline - v0.3

## Scope

Person A owns browser-side capture, review, upload pre-validation and optional transcript preview for the Diagnose and Billing golden paths. The browser validates media before submission, but the backend must repeat all security- and correctness-critical checks. The frontend does not perform semantic diagnosis or authoritative bill arithmetic.

## Capture architecture

```text
User gesture
  -> getUserMedia
  -> AudioContext + AudioWorklet
  -> mono Float32 frames (browser context rate)
  -> bounded in-memory buffer (maximum 15 seconds)
  -> resample to 16 kHz
  -> encode signed PCM16 WAV
  -> strict WAV validation
  -> review / playback / retake / clear
  -> multipart API request
```

## Modules

- public/audio/pcm-capture-processor.js: captures mono Float32 frames through AudioWorklet and emits a throttled RMS input level for the live microphone signal.
- src/lib/audio/wav.ts: resampling, PCM16 WAV encoding and capture limits.
- src/lib/audio/use-audio-recorder.ts: permission handling, recorder lifecycle, timer, cleanup, output Blob and preview URL.
- src/lib/media-validation.ts: shared strict validation for diagnosis and billing uploads. It checks PCM WAV structure and JPEG size/type/signatures before requests.
- src/lib/audio/audio-file.ts: legacy signature-sniffing helper retained for isolated format tests; its MP3/M4A support is not exposed by the MVP diagnosis or billing upload controls.
- src/lib/audio/use-live-transcript.ts: optional Web Speech API transcript preview for hi-IN or en-IN.
- src/app/workspace/page.tsx: diagnosis presentation and user actions.
- src/app/workspace/billing-workflow.tsx: billing capture, extraction, editing, confirmation and local draft workflow.

## MVP media rules

### Audio

- Diagnose and Billing accept PCM WAV only.
- Maximum file size: 2 MiB.
- Maximum duration: 15 seconds.
- Required encoding: uncompressed PCM16, mono, 16,000 Hz.
- The validator parses RIFF chunks instead of assuming a fixed 44-byte header. It checks the RIFF/WAVE signature and declared length, format/data chunks, codec, channel count, sample rate, bit depth, byte rate, block alignment, complete sample frames and duration.
- Empty, truncated, malformed, oversized, unsupported-codec and extension/MIME-mismatched files are rejected with actionable messages.
- Uploaded MP3 and M4A are not accepted by the MVP UI. The backend must independently validate and decode all received media.

### Image

- Optional diagnosis image: JPEG only (.jpg / .jpeg, image/jpeg).
- Maximum file size: 1.5 MiB.
- The frontend checks the extension, MIME type, JPEG start/end markers and attempts browser decoding with createImageBitmap where available.
- The UI provides preview, replacement and removal. The backend must independently validate and decode the image; client-side checks are not a security boundary.

## Transcript preview and correctness

- Live transcription is opt-in. The browser speech provider may process audio outside Ustaad; the UI discloses this before enabling it.
- The browser API is not consistently available and may differ by browser/device. The preview currently offers Hindi (hi-IN) and Indian English (en-IN); mixed Hindi-English recognition quality is not guaranteed.
- The transcript is editable and must be treated as a draft, not as a verified record of what the technician said.
- The frontend does not claim semantic correctness. Model names, error codes, quantities and prices must be reviewed by the user. Diagnosis responses are normalized defensively; missing KB identity forces an unverified state and repair steps are withheld.
- No translation engine is implemented here. Translation or language normalization must be an explicit backend/product decision, not an invisible rewrite of the technician's words.

## Privacy and lifecycle

- Recorded WAV remains in browser memory and is not written to localStorage, IndexedDB or disk.
- Recent bill drafts may be stored in localStorage, but audio and image bytes are never stored there.
- Microphone tracks and AudioContext are released on stop, clear, error and unmount.
- Object URLs are revoked when previews are replaced, cleared or unmounted.
- The optional browser speech preview is a separate browser-controlled processing path and requires explicit opt-in.

## Automated checks

Run npm test from frontend. It currently runs:

1. test:audio: resampling, PCM16 WAV encoding and legacy signature-helper checks.
2. test:media: strict WAV validation, 15-second boundary, RIFF chunk parsing, malformed/truncated audio, codec/channel/sample-rate/size checks and JPEG extension/MIME/signature/size checks.
3. test:diagnosis: demo scenarios, incomplete response normalization, KB grounding fail-closed behaviour and four-step cap.
4. test:billing: missing-price handling, demo-only total calculation, decimal quantity rounding, WhatsApp text and numeric overflow.

These tests do not establish speech-to-text accuracy or real browser codec/device behaviour. source-pack/test_clips_diagnose.csv and source-pack/test_clips_billing.csv provide expected spoken phrases and interpretation fields, but they are text scripts rather than recorded audio. Real accuracy requires browser/device tests with recordings from technicians and the backend's chosen transcription/decoding implementation.

## API boundary

The central frontend API client uses the frozen contracts:

- GET /health
- POST /api/diagnose (multipart audio, optional image and language)
- POST /api/bill (multipart audio and optional customer name)
- POST /api/bill/confirm (JSON draft items and unsupported mentions)
- POST /api/tts (JSON text and language; playback remains pending backend support)

The diagnosis and billing workflows are wired to these contracts. Until Person B implements the endpoints, use the explicitly labelled demo scenarios. Demo bill confirmation is a simulated backend response only; production totals and WhatsApp text must come from the backend.
