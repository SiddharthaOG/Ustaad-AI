import type { DiagnosisResponse } from "./contracts";

export type DiagnosisDemoScenario =
  | "verified-safety"
  | "unverified"
  | "clarification"
  | "no-code"
  | "backend-failure"
  | "timeout";

export const diagnosisDemoScenarios: Record<DiagnosisDemoScenario, { label: string; result?: DiagnosisResponse; error?: string }> = {
  "verified-safety": {
    label: "Verified fault + safety warning",
    result: {
      transcript: "AC unit starts but the outdoor fan is not running and there is a burning smell.",
      detected_code: "FAN-OUT-01",
      kb_id: "DEMO-AC-014",
      grounded: true,
      needs_confirmation: false,
      confirm_question: null,
      error_meaning: "Outdoor fan operation requires inspection. The reported burning smell makes isolation the first priority.",
      probable_causes: ["Outdoor fan motor or its wiring may be damaged.", "A loose or overheated electrical connection may be present."],
      safety_alert: "Switch off and isolate the AC at the mains before inspection. Do not touch exposed wiring or restart the unit while a burning smell is present.",
      steps: ["Isolate the power supply and verify it is off using an appropriate tester.", "Visually inspect the fan wiring and connector for heat damage without touching live components.", "Have a qualified technician test the motor and capacitor against the unit's service specification.", "Replace only the confirmed failed component, then perform a controlled test."],
      spoken_summary: "First isolate the power. The burning smell needs to be checked before the unit is restarted.",
      source: "Ustaad demonstration service reference",
      photo_note: null,
      provider: "demo-fixture",
      latency_ms: 420,
    },
  },
  unverified: {
    label: "Unverified diagnosis",
    result: {
      transcript: "The machine makes a rattling noise after ten minutes.",
      detected_code: null,
      kb_id: null,
      grounded: false,
      needs_confirmation: false,
      confirm_question: null,
      error_meaning: "The symptoms do not match a verified reference in the available knowledge base.",
      probable_causes: ["A loose panel or mounting point is possible.", "A rotating component may be vibrating."],
      safety_alert: "If the noise is accompanied by smoke, burning smell, abnormal heat or electrical arcing, switch off and isolate the equipment.",
      steps: ["Do not perform repairs based on this unverified result."],
      spoken_summary: "I cannot verify the cause yet. Please share the model number and a closer description of the noise.",
      source: null,
      photo_note: null,
      provider: "demo-fixture",
      latency_ms: 390,
    },
  },
  clarification: {
    label: "Clarification required",
    result: {
      transcript: "The AC shows an error after startup.",
      detected_code: null,
      kb_id: null,
      grounded: false,
      needs_confirmation: true,
      confirm_question: "What exact code appears on the indoor unit display, and what is the brand and model?",
      error_meaning: "The error code and model are needed before a reliable reference can be selected.",
      probable_causes: [],
      safety_alert: "",
      steps: [],
      spoken_summary: "Please tell me the exact code and model number so I can check the right service reference.",
      source: null,
      photo_note: null,
      provider: "demo-fixture",
      latency_ms: 310,
    },
  },
  "no-code": {
    label: "No fault code detected",
    result: {
      transcript: "",
      detected_code: null,
      kb_id: null,
      grounded: false,
      needs_confirmation: true,
      confirm_question: "Can you describe the symptoms and share the equipment brand and model?",
      error_meaning: null,
      probable_causes: [],
      safety_alert: "",
      steps: [],
      spoken_summary: "I could not identify a fault code from this recording. Please describe what the equipment is doing.",
      source: null,
      photo_note: null,
      provider: "demo-fixture",
      latency_ms: 280,
    },
  },
  "backend-failure": { label: "Backend failure", error: "Demo: the diagnosis service returned an internal error. Your recording is retained so you can retry." },
  timeout: { label: "Request timeout (simulated)", error: "Demo: the diagnosis request timed out. Your recording is retained so you can retry." },
};
