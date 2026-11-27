# Frontend Scope — Person A

## First milestone: usable UI with mock data

Build the two golden paths before wiring the backend:

- Diagnosis workspace: record audio, optionally attach a photo, show recording/upload state, render a grounded result, show safety warning before steps, and expose a clear unknown/unverified state.
- Billing workspace: capture a spoken job description, render editable parts/labour rows, recalculate totals in the browser for immediate editing UX (backend remains authoritative at submission), clearly flag missing prices, and provide a WhatsApp handoff.

## UX principles

- Mobile-first; designed for a mechanic using a phone in a noisy workshop.
- Large touch targets, high contrast, short labels, obvious recording state.
- Hindi/Hinglish-friendly copy; avoid jargon where possible.
- Always show when the app is listening, processing, or waiting for confirmation.
- Never display an unverified model guess as a confirmed diagnosis.
- Safety warning is visually prominent and precedes repair steps.
- Bill totals are visibly marked provisional until backend confirmation.

## Integration boundary

Keep all network calls in a small API client module. Use typed request/response models based on the shared contract; until Person B publishes it, use local mock fixtures and mark them as mocks.

## Initial component map

- App shell / navigation
- Diagnosis capture panel
- Audio recorder control
- Optional photo uploader
- Diagnosis result + safety alert + repair steps
- Bill capture panel
- Editable bill line items
- Missing-price confirmation state
- Bill total + WhatsApp share action
