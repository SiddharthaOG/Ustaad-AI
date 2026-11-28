<div align="center">

# Ustaad AI

**A voice-first diagnostic co-pilot for India's mechanics and field technicians.**

Speak the problem. Understand the machine. Make the next decision with confidence.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Gemini](https://img.shields.io/badge/AI-Gemini-8E75B2?style=flat-square&logo=googlegemini)](https://ai.google.dev/)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://render.com/)

[**Open Ustaad AI**](https://ustaad-ai-siddharthaog.vercel.app/) · [Source code](https://github.com/SiddharthaOG/Ustaad-AI) · [Project plan](./Ustaad_AI_Dual_Execution_Plan.md)

</div>

---

## The idea

A technician shouldn't have to stop working, navigate complicated software, or guess their way through a fault. Ustaad AI is designed around a more natural interaction: describe the problem in your own words, optionally show the equipment, and get a structured response that makes uncertainty visible.

The project focuses on two practical moments in a technician's workflow:

- **Diagnosis:** understand a spoken fault description, identify relevant equipment information, and return only findings supported by the verified knowledge base.
- **Job handoff and billing:** carry the service context into an editable bill workflow, where line items can be reviewed before anything is shared.

## What you can explore

### Voice-first diagnosis

- Record or upload a supported audio clip.
- Optionally attach an equipment photo.
- Review the transcript and structured diagnosis.
- See the source behind a grounded fault-code match.
- Listen to a generated spoken summary where supported.
- Receive safety guidance before repair steps.

### Three guided workshop stories

The prepared roleplay demonstrates how the same workflow responds to different situations:

| Scenario | What it demonstrates |
|---|---|
| **Rajesh — air conditioner** | Equipment identification, CH67 extraction, manufacturer-scoped knowledge lookup and source display |
| **Amit — unsafe DIY attempt** | Uncertainty handling, safety-first guidance and escalation instead of risky instructions |
| **Imran — commercial refrigerator** | Equipment-specific intake, food-safety considerations and responsible escalation when the knowledge base cannot support a fault claim |

The stories use sample customer details and clearly labelled demo fixtures. They are guided demonstrations, not real customer service records.

### Billing handoff

The roleplay can carry the customer's context into the billing experience. Sample line items are illustrative and are clearly identified as demo data. **The billing backend integration is a separate workstream; the sample workflow must not be mistaken for a live invoice, payment, or message sent to a customer.**

---

## Product principles

Ustaad is intended to assist a technician, not replace their judgement.

1. **Ground facts, don't invent them.** A fault meaning or source is shown as verified only when it matches an approved knowledge-base entry.
2. **Safety before troubleshooting.** Deterministic safety guidance takes priority over repair instructions.
3. **Make uncertainty visible.** Ambiguous, unsupported or unverified results should ask for confirmation or remain explicitly ungrounded.
4. **Keep the human in control.** Technicians review findings and bill details before acting or sharing.
5. **Treat media carefully.** Audio and image uploads are validated and processed in memory; the backend is not designed to persist them.

---

## Architecture

<div align="center">

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | Recording, media review, diagnosis UI, guided stories and billing experience |
| Backend | Python, FastAPI, Pydantic | Media validation, diagnosis orchestration, response validation and safety handling |
| AI services | Google Gemini | Speech/content interpretation and text-to-speech generation |
| Knowledge | Verified, manufacturer-scoped entries | Grounding fault-code meanings and source references |
| Hosting | Vercel + Render | Frontend and API deployment |

</div>

### Request flow

```text
Technician
    |
    v
Next.js workspace
    |  audio + optional JPEG
    v
FastAPI backend
    |
    +--> Validate media
    |
    +--> Gemini interpretation
    |
    +--> Validate extracted candidate
    |
    +--> Match verified knowledge base
    |
    +--> Apply deterministic safety rules
    |
    v
Structured diagnosis + source + safety guidance
    |
    v
Frontend review and optional spoken summary
```

The model interprets the input; it is not the authority for fault-code facts, citations, safety policy or bill arithmetic. The backend and application logic enforce those boundaries.

---

## Repository layout

```text
Ustaad-AI/
├── frontend/                 # Next.js application
│   ├── src/app/              # Landing page and workspace
│   ├── src/lib/api/          # API client, contracts and demo fixtures
│   └── scripts/              # Frontend regression tests
├── backend/                  # FastAPI service
│   ├── app/                  # API, validation and diagnosis logic
│   ├── data/                 # Knowledge and safety datasets
│   └── tests/                # Backend tests
├── source-pack/              # Reference material and source datasets
├── docs/                     # Project and audit documentation
└── Ustaad_AI_Dual_Execution_Plan.md
```

---

## Run locally

### Prerequisites

- Node.js and npm
- Python 3.11+
- A Gemini API key for live backend diagnosis and TTS requests

### 1. Clone the repository

```bash
git clone https://github.com/SiddharthaOG/Ustaad-AI.git
cd Ustaad-AI
```

### 2. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Configure and start the backend

In a second terminal, from the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Add your Gemini API key to `backend/.env`, then start the service:

```powershell
uvicorn app.main:app --app-dir backend --env-file backend/.env --reload --host 127.0.0.1 --port 8000
```

The API health endpoint is [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health), and interactive API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Use the frontend's documented environment configuration to point it at your local backend. Never commit real API keys or `.env` files.

---

## Tests

Run frontend checks from `frontend/`:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Run backend tests from the repository root:

```bash
python -m compileall -q backend\app backend\tests
python -m pytest -q backend\tests
```

---

## Current scope and limitations

- Live diagnosis and TTS use the connected backend service.
- Diagnosis grounding is limited to entries that pass the backend's verification rules. Unsupported equipment or codes must remain ungrounded.
- Hindi/Hinglish speech quality can vary by model and input; generated audio should be reviewed before relying on it.
- The three workshop narratives contain fictional customers and scenario data for demonstration.
- Billing fixtures are illustrative until the separate billing backend integration is complete. Do not treat them as authoritative prices, invoices, payments or sent WhatsApp messages.
- The product is a prototype and does not replace qualified technical judgement, manufacturer documentation or applicable safety procedures.

## Project documentation

- [Dual execution plan](./Ustaad_AI_Dual_Execution_Plan.md)
- [Backend setup and API notes](./backend/README.md)
- [Source pack](./source-pack/)

---

<div align="center">

**Built for the people who keep things running.**

*Bolo. Dikhao. Samajho.*

</div>
