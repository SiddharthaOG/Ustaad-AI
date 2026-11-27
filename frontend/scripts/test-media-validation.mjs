import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { File } from "node:buffer";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/media-validation.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateDiagnosisWav, validateDiagnosisImage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function wav({ sampleRate = 16000, channels = 1, bits = 16, codec = 1, seconds = 0.5, truncate = false } = {}) {
  const bytesPerSample = bits / 8;
  const dataSize = Math.floor(sampleRate * channels * bytesPerSample * seconds);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(codec, 20);
  buffer.writeUInt16LE(channels, 22); buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32); buffer.writeUInt16LE(bits, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(dataSize, 40);
  return truncate ? buffer.subarray(0, 40) : buffer;
}
const audioFile = (bytes, name = "test.wav") => new File([bytes], name, { type: "audio/wav" });
const jpeg = () => new File([Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0xff, 0xd9])], "unit.jpg", { type: "image/jpeg" });

const valid = await validateDiagnosisWav(audioFile(wav()));
assert.equal(valid.valid, true);
assert.ok(valid.valid && valid.durationSeconds > 0);

for (const [label, input] of [
  ["compressed codec", wav({ codec: 3 })],
  ["stereo", wav({ channels: 2 })],
  ["wrong sample rate", wav({ sampleRate: 44100 })],
  ["8-bit PCM", wav({ bits: 8 })],
  ["over 15 seconds", wav({ seconds: 16 })],
  ["truncated header", wav({ truncate: true })],
]) {
  const result = await validateDiagnosisWav(audioFile(input));
  assert.equal(result.valid, false, `Expected rejection: ${label}`);
}
assert.equal((await validateDiagnosisWav(audioFile(wav(), "fake.mp3"))).valid, false);
assert.equal((await validateDiagnosisWav(new File([wav()], "wrong-mime.wav", { type: "audio/mpeg" }))).valid, false);
assert.equal((await validateDiagnosisWav(audioFile(new Uint8Array(2 * 1024 * 1024 + 1)))).valid, false);

assert.equal((await validateDiagnosisImage(jpeg())).valid, true);
assert.equal((await validateDiagnosisImage(new File([jpeg()], "unit.png", { type: "image/png" }))).valid, false);
assert.equal((await validateDiagnosisImage(new File([Uint8Array.from([1, 2, 3])], "fake.jpg", { type: "image/jpeg" }))).valid, false);
assert.equal((await validateDiagnosisImage(new File([new Uint8Array(1_600_000)], "large.jpg", { type: "image/jpeg" }))).valid, false);

console.log("✔ strict WAV validation: PCM16, mono, 16 kHz, duration, size, signature and truncation");
console.log("✔ JPEG validation: extension, MIME, signature and 1.5 MB size limit");
console.log("ℹ 14 validation assertions passed");
