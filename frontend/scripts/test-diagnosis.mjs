import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadTs(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const { normalizeDiagnosisResponse } = await loadTs("../src/lib/api/diagnosis-response.ts");
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

const incomplete = normalizeDiagnosisResponse({ grounded: false, needs_confirmation: true, steps: "bad" });
assert.equal(incomplete.result.transcript, "");
assert.equal(incomplete.result.grounded, false);
assert.ok(incomplete.warnings.length >= 3);
assert.throws(() => normalizeDiagnosisResponse(null));

console.log("✔ all six diagnosis demo scenarios are defined");
console.log("✔ incomplete and ungrounded responses fail closed; repair steps are withheld");
console.log("✔ verified repair steps are capped at four");
console.log("ℹ diagnosis response checks passed");
