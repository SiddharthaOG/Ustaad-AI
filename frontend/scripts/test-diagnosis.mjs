import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadTs(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const { normalizeDiagnosisResponse, buildDiagnosisNarration } = await loadTs("../src/lib/api/diagnosis-response.ts");
const { diagnosisDemoScenarios } = await loadTs("../src/lib/api/diagnosis-scenarios.ts");

for (const key of ["verified-safety", "unverified", "clarification", "no-code"]) {
  const fixture = diagnosisDemoScenarios[key].result;
  assert.ok(fixture, `Missing demo fixture: ${key}`);
  const normalized = normalizeDiagnosisResponse(fixture);
  assert.equal(normalized.result.grounded, fixture.grounded);
  if (!fixture.grounded) assert.equal(normalized.result.steps.length, 0);
}
assert.ok(diagnosisDemoScenarios["backend-failure"].error);
assert.ok(diagnosisDemoScenarios.timeout.error);

const missingKb = normalizeDiagnosisResponse({
  grounded: true, steps: ["Do a repair"], probable_causes: [], transcript: "Noise",
});
assert.equal(missingKb.result.grounded, false);
assert.equal(missingKb.result.steps.length, 0);
assert.ok(missingKb.warnings.some((warning) => warning.includes("knowledge-base ID")));

const capped = normalizeDiagnosisResponse({
  grounded: true, kb_id: "KB-1", steps: ["1", "2", "3", "4", "5"], probable_causes: [],
  transcript: "Test", detected_code: null, needs_confirmation: false, confirm_question: null,
  error_meaning: null, safety_alert: "", spoken_summary: "", source: "Test source",
  photo_note: null, provider: "fixture", latency_ms: 10,
});
assert.equal(capped.result.steps.length, 4);

const verifiedNarration = buildDiagnosisNarration(capped.result);
assert.match(verifiedNarration, /No specific fault code was identified/);
assert.match(verifiedNarration, /What Ustaad heard: Test/);
assert.match(verifiedNarration, /Step 1\. 1/);
assert.doesNotMatch(verifiedNarration, /Grounded|VERIFIED SOURCE|spoken_summary/);
assert.doesNotMatch(verifiedNarration, /5\./, "Narration must respect the four-step cap");

const fullDiagnosis = normalizeDiagnosisResponse({
  transcript: "Mere LG AC mein CH05 error show kar raha hai, iska matlab kya hai?",
  detected_code: "CH05", kb_id: "lg-ch05", grounded: true, needs_confirmation: false,
  confirm_question: null, error_meaning: "Communication problem between the indoor and outdoor units",
  probable_causes: ["Temporary communication or power error", "Faulty wiring or a loose connector", "Problem with the main circuit board"],
  safety_alert: "Switch off power before inspection. Do not open electrical panels or touch wiring unless qualified.",
  steps: ["Power-cycle: switch off the breaker, wait 5 minutes, restore power", "Contact the installer if recently relocated", "Seek service if the error persists"],
  spoken_summary: "Short summary only", source: "LG India guide", photo_note: null, provider: "fixture", latency_ms: 1,
}).result;
const fullNarration = buildDiagnosisNarration(fullDiagnosis);
for (const phrase of ["Fault code CH05", "What Ustaad heard:", "Safety first.", "Possible causes:", "Suggested checks:", "Step 1.", "Step 2.", "Step 3."]) {
  assert.ok(fullNarration.includes(phrase), `Narration missing ${phrase}`);
}
assert.ok(!fullNarration.includes("Short summary only"));

const awaitingConfirmation = normalizeDiagnosisResponse({
  grounded: true, kb_id: "KB-1", needs_confirmation: true, confirm_question: "What model is this?",
  steps: ["Perform the repair"], probable_causes: [], transcript: "Test",
});
assert.equal(awaitingConfirmation.result.grounded, true);
assert.equal(awaitingConfirmation.result.steps.length, 0);
assert.ok(awaitingConfirmation.warnings.some((warning) => warning.includes("clarification")));

const pendingNarration = buildDiagnosisNarration(awaitingConfirmation.result);
assert.match(pendingNarration, /needs one more detail/i);
assert.doesNotMatch(pendingNarration, /Step 1\./);

const incomplete = normalizeDiagnosisResponse({ grounded: false, needs_confirmation: true, steps: "bad" });
assert.equal(incomplete.result.transcript, "");
assert.equal(incomplete.result.grounded, false);
assert.ok(incomplete.warnings.length >= 3);
assert.throws(() => normalizeDiagnosisResponse(null));

console.log("âœ” all six diagnosis demo scenarios are defined");
console.log("âœ” incomplete and ungrounded responses fail closed; repair steps are withheld");
console.log("âœ” verified repair steps are capped at four");
console.log("â„¹ diagnosis response checks passed");
