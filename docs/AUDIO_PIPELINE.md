# Browser Audio Pipeline - v0.2

## Scope

Person A owns browser-side capture, review, upload pre-validation and transcript preview for the Diagnose and Billing golden paths. This layer does not call the backend, perform semantic diagnosis, calculate bills, or persist recordings.

## Capture architecture

```text
User gesture
  -> getUserMedia
  -> AudioContext + AudioWorklet
  -> mono Float32 frames (browser context rate)
  -> bounded in-memory buffer (maximum 15 seconds)
  -> resample to 16 kHz
  -> encode signed PCM16 WAV
  -> validate duration and <= 2 MiB output
  -> review / playback / retake / clear
  -> later: approved multipart API contract
```

### Modules

- `public/audio/pcm-capture-processor.js`: captures mono Float32 frames through AudioWorklet.
- `src/lib/audio/wav.ts`: resampling, PCM16 WAV encoding and capture limits.
- `src/lib/audio/use-audio-recorder.ts`: permission handling, recorder lifecycle, timer, cleanup, output Blob and preview URL.
- `src/lib/audio/audio-file.ts`: pre-validates uploaded WAV, MP3 and M4A files by size, extension and basic container/codec signatures.
- `src/lib/audio/use-live-transcript.ts`: optional Web Speech API transcript preview for `hi-IN` or `en-IN`.
- `tests/audio.test.mjs` plus `scripts/test-audio.mjs`: Node built-in tests, compiling the pure TypeScript modules into a temporary directory first.
- `src/app/workspace/page.tsx`: presentation and user actions; no DSP or encoding logic.

## Audio upload rules

- Allowed filename extensions: `.wav`, `.mp3`, `.m4a`.
- File must be non-empty and no larger than 2 MiB.
- Extension must match the inspected file signature.
- WAV must have a RIFF/WAVE header, a complete header and PCM integer (format 1) or IEEE-float (format 3) codec marker.
- MP3 is checked for an MPEG audio frame sync, including after an ID3 tag.
- M4A is checked for an ISO base-media `ftyp` marker and a supported major brand.
- These are frontend preflight checks, not full media decoding. The backend must independently validate, decode and normalize uploaded media. This frontend does not transcode uploaded MP3/M4A files.

## Transcript preview and correctness

- Live transcription is opt-in. The browser speech provider may process audio outside Ustaad; the UI discloses this before enabling it.
- The browser API is not consistently available and may differ by browser/device. The preview currently offers Hindi (`hi-IN`) and Indian English (`en-IN`); mixed Hindi-English recognition quality is not guaranteed.
- The transcript is editable and must be treated as a draft, not as a verified record of what the technician said.
- The frontend does not claim semantic correctness. Model names, error codes, quantities and prices must be reviewed by the user. After backend integration, ambiguity must be represented using the contract's `needs_confirmation` and `confirm_question` fields; missing bill prices must remain unconfirmed.
- No translation engine is implemented here. Translation or language normalization must be an explicit backend/product decision, not an invisible rewrite of the technician's words.

## Privacy and lifecycle

- Recorded WAV remains in browser memory and is not written to localStorage, IndexedDB or disk.
- Microphone tracks and AudioContext are released on stop, clear, error and unmount.
- Object URLs are revoked when previews are replaced, cleared or unmounted.
- The optional browser speech preview is a separate third-party/browser-controlled processing path and requires explicit opt-in.

## Automated checks

Run `npm run test:audio` from `frontend`. Tests currently cover:

1. 48 kHz to 16 kHz resampling.
2. PCM16 mono 16 kHz WAV headers and expected size.
3. WAV, MP3 and M4A signatures.
4. Unsupported extension, empty and oversized files.
5. Extension/signature mismatch and unsupported WAV codec.
6. Truncated WAV rejection and the 15-second / 2 MiB limits.

Speech-to-text accuracy, translation and real codec decoding are not covered by these unit tests. `source-pack/test_clips_diagnose.csv` and `source-pack/test_clips_billing.csv` provide expected spoken phrases and expected interpretation fields, but they are text scripts rather than recorded audio. `source-pack/make_synthetic_clips.py` can generate synthetic TTS WAVs for pipeline testing; keep generated clips outside the hackathon repository and do not use synthetic results to claim real-world accuracy. Real accuracy requires browser/device tests with recordings from technicians and the backend's chosen transcription/decoding implementation.

## API boundary

The existing `api_contract_examples.json` contains response fixtures, not the multipart request schema. Do not invent multipart field names or send files until Person A and Person B freeze the shared API contract. The backend remains authoritative for upload validation, transcript interpretation, safety, bill arithmetic and confirmation rules.
