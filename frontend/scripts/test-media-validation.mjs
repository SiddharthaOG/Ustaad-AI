import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { File } from "node:buffer";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/media-validation.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateDiagnosisWav, validateDiagnosisImage, MAX_DIAGNOSIS_AUDIO_BYTES, MAX_DIAGNOSIS_IMAGE_BYTES } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function wav({ sampleRate = 16000, channels = 1, bits = 16, codec = 1, seconds = 0.5, truncate = false, extraChunk = false, partialFrame = false } = {}) {
  const bytesPerSample = bits / 8;
  const dataSize = partialFrame ? 1 : Math.floor(sampleRate * channels * bytesPerSample * seconds);
  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0); fmt.writeUInt32LE(16, 4); fmt.writeUInt16LE(codec, 8);
  fmt.writeUInt16LE(channels, 10); fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE(sampleRate * channels * bytesPerSample, 16);
  fmt.writeUInt16LE(channels * bytesPerSample, 20); fmt.writeUInt16LE(bits, 22);
  const data = Buffer.alloc(8 + dataSize + (dataSize % 2));
  data.write("data", 0); data.writeUInt32LE(dataSize, 4);
  const junk = Buffer.alloc(12);
  junk.write("JUNK", 0); junk.writeUInt32LE(3, 4); junk.write("abc", 8);
  const body = Buffer.concat(extraChunk ? [junk, fmt, data] : [fmt, data]);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0); header.writeUInt32LE(body.length + 4, 4); header.write("WAVE", 8);
  const result = Buffer.concat([header, body]);
  return truncate ? result.subarray(0, 40) : result;
}
const audioFile = (bytes, name = "test.wav", type = "audio/wav") => new File([bytes], name, { type });
const jpegBytes = (size = 7) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff], 0);
  bytes.set([0xff, 0xd9], size - 2);
  return bytes;
};
const jpeg = (size = 7, name = "unit.jpg", type = "image/jpeg") => new File([jpegBytes(size)], name, { type });

assert.equal(MAX_DIAGNOSIS_AUDIO_BYTES, 2 * 1024 * 1024);
assert.equal(MAX_DIAGNOSIS_IMAGE_BYTES, 1.5 * 1024 * 1024);
assert.equal((await validateDiagnosisWav(audioFile(wav()))).valid, true);
assert.equal((await validateDiagnosisWav(audioFile(wav({ seconds: 15 })))).valid, true);
assert.equal((await validateDiagnosisWav(audioFile(wav({ extraChunk: true })))).valid, true);

for (const [label, input] of [
  ["compressed codec", wav({ codec: 3 })],
  ["stereo", wav({ channels: 2 })],
  ["wrong sample rate", wav({ sampleRate: 44100 })],
  ["8-bit PCM", wav({ bits: 8 })],
  ["over 15 seconds", wav({ seconds: 16 })],
  ["truncated header", wav({ truncate: true })],
  ["partial PCM frame", wav({ partialFrame: true })],
]) {
  const result = await validateDiagnosisWav(audioFile(input));
  assert.equal(result.valid, false, `Expected rejection: ${label}`);
}
assert.equal((await validateDiagnosisWav(audioFile(wav(), "fake.mp3"))).valid, false);
assert.equal((await validateDiagnosisWav(audioFile(wav(), "wrong-mime.wav", "audio/mpeg"))).valid, false);
assert.equal((await validateDiagnosisWav(audioFile(new Uint8Array(MAX_DIAGNOSIS_AUDIO_BYTES + 1)))).valid, false);

assert.equal((await validateDiagnosisImage(jpeg())).valid, true);
assert.equal((await validateDiagnosisImage(jpeg(MAX_DIAGNOSIS_IMAGE_BYTES, "boundary.jpeg"))).valid, true);
assert.equal((await validateDiagnosisImage(jpeg(7, "unit.png", "image/png"))).valid, false);
assert.equal((await validateDiagnosisImage(new File([Uint8Array.from([1, 2, 3])], "fake.jpg", { type: "image/jpeg" }))).valid, false);
assert.equal((await validateDiagnosisImage(jpeg(1_600_000, "large.jpg"))).valid, false);

console.log("✔ WAV: PCM16, mono, 16 kHz, 15-second boundary, chunk parsing, size and truncation");
console.log("✔ WAV rejects compressed codecs, stereo, wrong rates, partial frames and MIME/extension mismatches");
console.log("✔ JPEG: extension, MIME, signature, 1.5 MB boundary and oversize handling");
console.log("ℹ strict media validation checks passed");
