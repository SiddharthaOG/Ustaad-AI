import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/app/workspace/page.tsx", import.meta.url), "utf8");
const result = await readFile(new URL("../src/app/workspace/diagnosis-result.tsx", import.meta.url), "utf8");

assert.match(page, /const speakDiagnosis = async \(\) =>/);
assert.match(page, /ustaadApi\.speak\(/);
assert.match(page, /const narration = buildDiagnosisNarration\(diagnosis\)/);
assert.match(page, /text: narration/);
assert.doesNotMatch(page, /text: diagnosis\.spoken_summary/);
assert.match(page, /onSpeak=\{\(\) => void speakDiagnosis\(\)\}/);
assert.match(page, /speechAudioUrl\]\);/);
assert.match(page, /speechSubmitting\.current/);
assert.match(page, /speechRequestId = useRef\(0\)/);
assert.match(page, /requestId !== speechRequestId\.current/);
assert.match(page, /const invalidateSpeech = \(\) =>/);
assert.match(result, /onSpeak && \(/);
assert.match(result, /disabled=\{speechLoading\}/);
assert.match(result, /role="alert"/);
assert.match(result, /controls preload="metadata" src=\{speechAudioUrl\}/);
assert.doesNotMatch(result, /autoPlay/);
console.log("? diagnosis summary is wired to the TTS API and renders loading, error and manual playback states");
