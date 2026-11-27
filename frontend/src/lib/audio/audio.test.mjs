import test from "node:test";
import assert from "node:assert/strict";
import { encodePcm16Wav, resampleMono, MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS } from "./wav.ts";
import { validateAudioFile } from "./audio-file.ts";

function wavBytes(codec = 1) {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 38, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, codec, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, 2, true); view.setInt16(44, 0, true);
  return bytes;
}

const makeFile = (name, bytes, type = "") => new File([bytes], name, { type });

test("resamples 48 kHz mono audio to 16 kHz", () => {
  const input = new Float32Array(48000).fill(0.25);
  const output = resampleMono(input, 48000);
  assert.equal(output.length, 16000);
  assert.ok(Math.abs(output[100] - 0.25) < 0.0001);
});

test("encodes a valid 16 kHz mono PCM16 WAV", async () => {
  const blob = encodePcm16Wav(new Float32Array(16000).fill(0.2));
  const bytes = new DataView(await blob.arrayBuffer());
  assert.equal(blob.type, "audio/wav");
  assert.equal(bytes.getUint16(20, true), 1);
  assert.equal(bytes.getUint16(22, true), 1);
  assert.equal(bytes.getUint32(24, true), 16000);
  assert.equal(bytes.getUint16(34, true), 16);
  assert.equal(blob.size, 32044);
});

test("accepts valid PCM WAV, MP3 and M4A signatures", async () => {
  const wav = await validateAudioFile(makeFile("clip.wav", wavBytes(), "audio/wav"));
  const mp3 = await validateAudioFile(makeFile("clip.mp3", new Uint8Array([0x49,0x44,0x33,0x04,0,0,0,0,0,0,0xff,0xfb,0x90,0x64]), "audio/mpeg"));
  const m4aBytes = new Uint8Array(16); m4aBytes.set([0,0,0,16,0x66,0x74,0x79,0x70,0x4d,0x34,0x41,0x20]);
  const m4a = await validateAudioFile(makeFile("clip.m4a", m4aBytes, "audio/mp4"));
  assert.equal(wav.valid && wav.format, "wav");
  assert.equal(mp3.valid && mp3.format, "mp3");
  assert.equal(m4a.valid && m4a.format, "m4a");
});

test("rejects unsupported extensions, empty files and oversized files", async () => {
  assert.equal((await validateAudioFile(makeFile("clip.ogg", new Uint8Array([1,2,3])))).valid, false);
  assert.equal((await validateAudioFile(makeFile("empty.mp3", new Uint8Array()))).valid, false);
  assert.equal((await validateAudioFile(makeFile("large.mp3", new Uint8Array(12)), 10)).valid, false);
});

test("rejects mismatched extensions and unsupported WAV codecs", async () => {
  const mismatch = await validateAudioFile(makeFile("clip.mp3", wavBytes(), "audio/mpeg"));
  const unsupported = await validateAudioFile(makeFile("clip.wav", wavBytes(6), "audio/wav"));
  assert.equal(mismatch.valid, false);
  assert.equal(unsupported.valid, false);
});

test("rejects a truncated WAV header", async () => {
  const result = await validateAudioFile(makeFile("truncated.wav", wavBytes().slice(0, 24), "audio/wav"));
  assert.equal(result.valid, false);
});

test("keeps capture limits explicit", () => {
  assert.equal(MAX_RECORDING_SECONDS, 15);
  assert.equal(MAX_AUDIO_BYTES, 2 * 1024 * 1024);
});
