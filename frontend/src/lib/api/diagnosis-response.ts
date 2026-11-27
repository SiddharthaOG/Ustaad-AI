import type { DiagnosisResponse } from "./contracts";

const text = (value: unknown): string => typeof value === "string" ? value : "";
const nullableText = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];

export function normalizeDiagnosisResponse(input: unknown): { result: DiagnosisResponse; warnings: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The diagnosis service returned an invalid response. Please retry.");
  }

  const raw = input as Record<string, unknown>;
  const warnings: string[] = [];
  if (typeof raw.grounded !== "boolean") warnings.push("The response did not include a valid grounding status; this result is treated as unverified.");
  if (typeof raw.transcript !== "string" || !raw.transcript.trim()) warnings.push("No transcript was returned for this recording.");
  if (raw.detected_code === undefined) warnings.push("No fault-code field was returned.");
  if (!Array.isArray(raw.steps) || !Array.isArray(raw.probable_causes)) warnings.push("Some diagnosis details were missing or malformed.");

  const grounded = raw.grounded === true && typeof raw.kb_id === "string" && raw.kb_id.trim().length > 0;
  if (raw.grounded === true && !grounded) warnings.push("The response claimed grounding but did not include a knowledge-base ID; it is treated as unverified.");
  if (raw.needs_confirmation === true && !nullableText(raw.confirm_question)) warnings.push("The response requested confirmation but did not provide a question.");
  const result: DiagnosisResponse = {
    transcript: text(raw.transcript),
    detected_code: nullableText(raw.detected_code),
    kb_id: nullableText(raw.kb_id),
    grounded,
    needs_confirmation: raw.needs_confirmation === true,
    confirm_question: nullableText(raw.confirm_question),
    error_meaning: nullableText(raw.error_meaning),
    probable_causes: stringList(raw.probable_causes),
    safety_alert: text(raw.safety_alert),
    steps: grounded ? stringList(raw.steps).slice(0, 4) : [],
    spoken_summary: text(raw.spoken_summary),
    source: nullableText(raw.source),
    photo_note: nullableText(raw.photo_note),
    provider: text(raw.provider) || "unknown",
    latency_ms: typeof raw.latency_ms === "number" && Number.isFinite(raw.latency_ms) ? Math.max(0, raw.latency_ms) : 0,
  };
  if (!grounded && Array.isArray(raw.steps) && raw.steps.length) warnings.push("Repair steps were withheld because the response was not grounded in a verified reference.");
  return { result, warnings };
}
