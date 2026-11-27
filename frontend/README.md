# Ustaad AI — Frontend

Next.js App Router + TypeScript + Tailwind CSS.

## Routes

- `/` — pitch-deck-aligned product landing page
- `/workspace` — interactive diagnosis and billing prototype

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

## Current state

The landing page translates the supplied nine-slide pitch deck into the web visual system: charcoal and warm ivory surfaces, saffron accent, workshop-green status cues, monospaced labels, blueprint/paper textures and restrained scroll reveals.

The workspace remains a frontend prototype with local-only interactions and clearly labelled sample diagnosis data. It does not call the backend yet.

- Diagnosis and billing workflow switcher
- Browser microphone recording (15-second cap)
- Audio and optional image file selection
- Sample diagnosis with safety-first layout
- Editable bill line items and subtotal
- Responsive desktop/tablet/mobile layout

## Commands

- `npm run dev` — local development
- `npm run lint` — ESLint
- `npm run build` — production build

## Integration rule

Keep API communication in a dedicated client module and wait for the jointly approved API contract before binding the UI to live endpoints. Never present mock results as verified live diagnosis.
