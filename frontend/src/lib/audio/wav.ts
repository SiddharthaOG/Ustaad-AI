export const TARGET_SAMPLE_RATE = 16_000;
export const MAX_RECORDING_SECONDS = 15;
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export function resampleMono(input: Float32Array, sourceRate: number, targetRate = TARGET_SAMPLE_RATE): Float32Array {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) throw new Error("Invalid source sample rate.");
  if (input.length === 0) return new Float32Array(0);
  if (sourceRate === targetRate) return input.slice();

  const outputLength = Math.floor(input.length * targetRate / sourceRate);
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

export function encodePcm16Wav(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE): Blob {
  if (samples.length === 0) throw new Error("No audio was captured. Please try again.");
  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, pcm, true);
    offset += bytesPerSample;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function getWavMetadata(blob: Blob): { sampleRate: number; channels: number; bitsPerSample: number; durationSeconds: number } {
  if (blob.size < 44) throw new Error("Invalid WAV: file is too small.");
  return {
    sampleRate: TARGET_SAMPLE_RATE,
    channels: 1,
    bitsPerSample: 16,
    durationSeconds: (blob.size - 44) / (TARGET_SAMPLE_RATE * 2),
  };
}
