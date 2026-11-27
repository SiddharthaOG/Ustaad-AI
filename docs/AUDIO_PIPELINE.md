# Browser Audio Pipeline ? v0.1

## Scope and source alignment

This is the Person A browser-capture implementation for the Diagnose golden path. It is deliberately limited to capture, normalization, validation, and a handoff-ready WAV Blob. It does not call the API, transcribe audio, persist recordings, or implement TTS.

The workflow follows the Ustaad AI Workflow and Implementation Blueprint and Person A's Capture Hardening milestone:
- microphone capture is capped at 15 seconds;
- captured audio is normalized to mono, 16,000 Hz, signed 16-bit PCM WAV;
- the upload artifact is validated against the 2 MB audio limit;
- microphone tracks and AudioContext resources are released after stop or failure;
- audio remains in browser memory only and is not persisted.

The API fixture is a response fixture, not an audio-upload request schema. The WAV format here follows the agreed implementation notes; final multipart field names and accepted upload formats must be confirmed in the shared API contract with Person B before integration.

## Architecture

```text
User gesture
  -> getUserMedia({ audio: true })
  -> AudioContext + AudioWorklet
  -> mono Float32 PCM frames (device/context sample rate)
  -> bounded in-memory frame buffer (<= 15 s)
  -> linear resampler (context rate -> 16 kHz)
  -> signed PCM16 encoder + 44-byte RIFF/WAVE header
  -> validate duration / MIME / byte size
  -> WAV Blob held in React state
  -> (later) API client multipart request
```

### Module boundaries

- `public/audio/pcm-capture-processor.js`: tiny AudioWorklet processor; captures channel 0 and transfers frame buffers to the main thread.
- `src/lib/audio/wav.ts`: pure resampling and WAV encoding helpers, independently testable.
- `src/lib/audio/use-audio-recorder.ts`: browser lifecycle, permission handling, state, timer, resource cleanup, and output Blob.
- `workspace/page.tsx`: presentation and user actions only; no DSP or WAV encoding logic.

### State model

`idle -> requesting -> recording -> processing -> ready`

Failures transition to `error`. `clear()` returns to `idle`; starting a new recording from `ready` is allowed. Stop is idempotent. The maximum duration triggers the same stop path as the user's stop action.

### Constraints and failure handling

- Secure context is required (`https` or localhost); unavailable APIs produce an actionable error.
- Permission denied, missing device, unsupported AudioWorklet, AudioContext failure, empty capture, and oversize output are explicit errors.
- The timer is a UI indicator and safety cap; the final PCM frame count is also checked to enforce <= 15 seconds.
- 16 kHz mono PCM16 at 15 seconds is approximately 480 KB, comfortably below 2 MB, but the byte limit is still enforced.
- No audio is written to localStorage, IndexedDB, disk, or a server by this module.

## Acceptance checks

1. Output Blob MIME is `audio/wav`.
2. RIFF/WAVE header is valid.
3. Format code is 1 (integer PCM), channels 1, sample rate 16000, byte rate 32000, block align 2, bits/sample 16.
4. Duration is greater than zero and no more than 15 seconds.
5. Data size is even and total size is <= 2 MiB.
6. Permission denial and unsupported browser paths show an error and release acquired resources.
7. Stop and unmount release microphone tracks and close AudioContext.
8. No network request or persistence occurs in this capture layer.

## Not included in this milestone

Audio file upload normalization, transcription, API request wiring, retry/idempotency, TTS playback, offline support, and backend validation. These remain separate tasks after the shared API contract is frozen.
