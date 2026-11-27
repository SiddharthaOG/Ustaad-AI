# Ustaad AI — Design System v0.1

This document translates the nine-slide Ustaad AI pitch deck into the product's web visual system. The deck is the source of truth for the visual direction.

## Visual identity

Ustaad AI should feel practical, confident, workshop-ready and distinctly Indian—not like a generic AI SaaS dashboard.

### Core palette

| Token | Hex | Use |
|---|---|---|
| Charcoal | `#1D2229` | Hero, dark sections, primary controls, navigation |
| Warm ivory | `#F5F2E9` | Main page background and warm surfaces |
| White | `#FFFEFA` | Cards and elevated surfaces |
| Saffron orange | `#F5A313` | Primary accent, CTA, numbering, safety emphasis |
| Workshop green | `#2CA365` | Positive state, verified/progress indicators |
| Slate | `#68717D` | Supporting text and metadata |
| Warm border | `#DED8C9` | Card outlines and separators |

## Typography

- Geist Sans for large headings, body copy and interface labels.
- Geist Mono for uppercase section labels, technical metadata and small indices.
- Use bold, compact headlines with tight tracking.
- Keep body copy readable and calm; avoid long marketing paragraphs.
- Use uppercase micro-labels with generous letter spacing to echo the deck.

## Surface language and textures

- Charcoal hero sections with a subtle blueprint grid.
- Warm ivory content sections with restrained paper grain / dot texture.
- White cards with thin warm borders and modest corner radii.
- Dark charcoal cards for emphasis and contrast.
- Saffron highlights should be deliberate; don't turn every component orange.
- Green is reserved for verified, positive or progress states.

## Motion principles

- Reveal content as it enters the viewport using IntersectionObserver.
- Use short, restrained vertical reveal transitions.
- Use slow ambient float on the hero phone and subtle waveform animation.
- Keep hover motion small (lift 3–5px, not dramatic scaling).
- Respect `prefers-reduced-motion`.
- Avoid scroll-jacking, heavy parallax and animation that delays access to content.

## Landing page structure

1. Hero: “Bolo. Dikhao. Theek karo.” and a phone product preview.
2. Problem: hands occupied, technical knowledge in English, billing leakage.
3. Workflow: Speak → Show → Hear → Bill.
4. Two golden paths: Diagnose and Bill.
5. Trust & safety: grounded answers, deterministic safety, code-based arithmetic, technician confirmation.
6. Closing CTA and footer.

## Product UI alignment

The workspace at `/workspace` must share the same palette, typography and component language. Its information density can be higher than the marketing page, but it must retain:
- charcoal navigation and primary actions;
- warm ivory canvas;
- white cards with warm borders;
- orange for primary emphasis;
- green for positive status only;
- prominent safety warnings before repair steps.

## Product truth

The landing page must not imply unsupported capabilities. The MVP focuses on Hindi/Hinglish voice diagnosis, optional photo input, verified fault-code grounding, spoken guidance with safety first, voice billing with editable line items, WhatsApp sharing and an installable PWA. Other languages, PDF receipts, history and offline mode remain roadmap items until implemented.
