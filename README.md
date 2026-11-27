# Ustaad AI

A voice-first diagnostic and billing assistant for Indian mechanics and field technicians.

## Product workflows

1. **Diagnose:** capture a spoken problem and optional equipment photo, return only knowledge-base-grounded diagnosis, deterministic safety warnings, and concise repair steps.
2. **Create a bill:** turn a spoken job description into editable parts and labour line items, calculate totals deterministically, and prepare a WhatsApp-ready summary.

## Architecture

- `frontend/`: Next.js App Router + TypeScript + Tailwind (Person A)
- `backend/`: FastAPI + Pydantic + Gemini integration (Person B)
- Shared API contract is to be frozen before real frontend/backend integration.

## Non-negotiable product rules

- The model interprets; it does not invent authoritative fault facts, prices, or arithmetic.
- Only verified knowledge-base entries can ground a diagnosis.
- Safety warnings are deterministic and appear before repair steps.
- Missing prices require confirmation; never guess.
- No GST is included in MVP bills.
- Do not persist uploaded audio or images on the server.

## Local frontend development

```powershell
cd frontend
npm install
npm run dev
```

See [the dual execution plan](./Ustaad_AI_Dual_Execution_Plan.md) and [source pack](./source-pack/) for project context and test fixtures.
