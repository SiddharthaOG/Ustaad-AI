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
    steps: grounded && raw.needs_confirmation !== true ? stringList(raw.steps).slice(0, 4) : [],
    spoken_summary: text(raw.spoken_summary),
    source: nullableText(raw.source),
    photo_note: nullableText(raw.photo_note),
    provider: text(raw.provider) || "unknown",
    latency_ms: typeof raw.latency_ms === "number" && Number.isFinite(raw.latency_ms) ? Math.max(0, raw.latency_ms) : 0,
  };
  if (!grounded && Array.isArray(raw.steps) && raw.steps.length) warnings.push("Repair steps were withheld because the response was not grounded in a verified reference.");
  if (grounded && raw.needs_confirmation === true && Array.isArray(raw.steps) && raw.steps.length) warnings.push("Repair steps were withheld until the requested clarification is answered.");
  return { result, warnings };
}

/** Build a plain-language narration from the visible diagnosis facts.
 * Never narrate UI badges/status labels or the shorter spoken_summary field.
 * Repair steps are included only when the response is grounded and no
 * clarification is pending (the normalizer already enforces this boundary).
 */
export function buildDiagnosisNarration(result: DiagnosisResponse): string {
  const sections: string[] = [];
  const fault = result.detected_code
    ? `Fault code ${result.detected_code}. ${result.error_meaning || "The exact meaning could not be verified."}`
    : result.error_meaning || "No specific fault code was identified.";
  sections.push(fault);

  if (result.transcript.trim()) sections.push(`What Ustaad heard: ${result.transcript.trim()}`);
  if (result.safety_alert.trim()) sections.push(`Safety first. ${result.safety_alert.trim()}`);
  if (result.needs_confirmation && result.confirm_question?.trim()) {
    sections.push(`Ustaad needs one more detail: ${result.confirm_question.trim()}. Do not proceed with repair steps until this is clarified.`);
  }
  if (result.photo_note?.trim()) sections.push(`Photo observation: ${result.photo_note.trim()}`);
  if (result.probable_causes.length) {
    sections.push(`Possible causes: ${result.probable_causes.map((cause, index) => `${index + 1}. ${cause}`).join(" ")}`);
  }
  if (result.grounded && !result.needs_confirmation && result.steps.length) {
    sections.push(`Suggested checks: ${result.steps.slice(0, 4).map((step, index) => `Step ${index + 1}. ${step}`).join(" ")}`);
  } else if (!result.grounded) {
    sections.push("This fault is not verified against the knowledge base. Repair steps have been withheld. Check the exact equipment model and consult a qualified technician.");
  }
  return sections.join("\n\n");
}
