# Person A — Frontend Execution Checklist

## F0 — Foundation

- [x] Create Next.js App Router + TypeScript + Tailwind project
- [x] Establish root monorepo and source-pack layout
- [x] Add mobile-first workshop workspace shell
- [x] Add Diagnose / Billing workflow switcher
- [x] Add browser microphone capture with 15-second cap
- [x] Add optional audio and image file selection
- [x] Add sample diagnosis panel with safety warning before steps
- [x] Add editable bill rows and subtotal
- [x] Run ESLint and production build

## F1 — Pitch-deck-aligned landing and visual system

- [x] Inspect all nine pitch deck slides and translate the visual language into design tokens
- [x] Create landing page at /
- [x] Move the existing diagnosis/billing workspace to /workspace
- [x] Add phone UI hero visual and the two golden paths
- [x] Add CSS grid / paper-grain textures
- [x] Add IntersectionObserver scroll reveals and reduced-motion support
- [x] Align workspace palette with the deck
- [ ] Review on real phone widths and refine spacing after visual QA
- [ ] Review landing copy with product owner

## F2 ? Capture hardening

- [ ] Test layout at 360px, 390px, tablet, and desktop widths
- [x] Add explicit microphone permission / unsupported-browser error states
- [x] Replace MediaRecorder capture with AudioWorklet mono 16 kHz signed PCM WAV encoding
- [x] Enforce 15-second capture duration and 2 MB generated-WAV limit
- [x] User-tested microphone permission, recording, stop and transcription on current device
- [ ] Repeat microphone QA on Android and other supported browsers
- [x] Validate uploaded WAV / MP3 / M4A files by extension, signature and 2 MB limit
- [x] Add audio review playback, clear and retake controls
- [ ] Enforce image (1.5 MB) client-side limit
- [ ] Add image preview and remove action
- [x] Add editable live transcript preview with explicit browser-speech opt-in (Hindi / Indian English)
- [x] Add automated audio codec / file validation tests
- [ ] Add browser/device transcription accuracy tests using supplied Hindi/Hinglish clips
- [ ] Add keyboard and screen-reader labels to all controls
- [ ] Confirm all user-visible demo states are marked as sample/mock

## F3 — API integration preparation

- [ ] Freeze shared API contract with Person B
- [ ] Add typed request/response models from the approved contract
- [ ] Add central API client and environment-based backend URL
- [ ] Replace sample diagnosis with loading / success / unknown / error states
- [ ] Replace sample bill extraction with editable backend response
- [ ] Add deterministic client-side form validation (backend remains authoritative)
- [ ] Add WhatsApp handoff using backend-generated bill text only

## F4 — Release readiness

- [ ] Add component / interaction tests
- [ ] Verify production build and lint in CI
- [ ] Add PWA/offline shell only after golden paths are stable
- [ ] Deploy frontend to Vercel after repository is connected
- [ ] Run full integration regression with Person B
