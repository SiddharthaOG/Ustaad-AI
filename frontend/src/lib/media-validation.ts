export const MAX_DIAGNOSIS_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_DIAGNOSIS_AUDIO_SECONDS = 15;
export const MAX_DIAGNOSIS_IMAGE_BYTES = 1.5 * 1024 * 1024;

export type MediaValidation =
  | { valid: true; file: File; durationSeconds?: number }
  | { valid: false; message: string };

export async function validateDiagnosisWav(file: File): Promise<MediaValidation> {
  if (file.size === 0) return { valid: false, message: "The audio file is empty." };
  if (file.size > MAX_DIAGNOSIS_AUDIO_BYTES) return { valid: false, message: "Audio files must be 2 MB or smaller." };
  if (!file.name.toLowerCase().endsWith(".wav")) return { valid: false, message: "Diagnosis accepts PCM WAV files only." };
  if (file.type && !["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"].includes(file.type)) {
    return { valid: false, message: "The selected file is not identified as a WAV audio file." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 44) return { valid: false, message: "The WAV file is truncated or its header is incomplete." };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") {
    return { valid: false, message: "The file is not a valid RIFF/WAVE recording." };
  }

  const declaredRiffEnd = view.getUint32(4, true) + 8;
  if (declaredRiffEnd > bytes.length || declaredRiffEnd < 44) {
    return { valid: false, message: "The WAV file is truncated or has an invalid RIFF length." };
  }

  let format: { codec: number; channels: number; sampleRate: number; byteRate: number; blockAlign: number; bits: number } | null = null;
  let dataBytes = 0;
  let offset = 12;
  while (offset + 8 <= declaredRiffEnd) {
    const id = ascii(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    if (end > declaredRiffEnd) return { valid: false, message: "A WAV data chunk is incomplete or truncated." };

    if (id === "fmt ") {
      if (size < 16) return { valid: false, message: "The WAV format chunk is incomplete." };
      format = {
        codec: view.getUint16(start, true),
        channels: view.getUint16(start + 2, true),
        sampleRate: view.getUint32(start + 4, true),
        byteRate: view.getUint32(start + 8, true),
        blockAlign: view.getUint16(start + 12, true),
        bits: view.getUint16(start + 14, true),
      };
    } else if (id === "data") {
      dataBytes = size;
    }
    offset = end + (size % 2);
  }

  if (!format || dataBytes <= 0) return { valid: false, message: "The WAV file must contain a format chunk and non-empty audio data." };
  if (format.codec !== 1 || format.bits !== 16) return { valid: false, message: "Use uncompressed PCM16 WAV audio." };
  if (format.channels !== 1) return { valid: false, message: "Audio must be mono (one channel)." };
  if (format.sampleRate !== 16000) return { valid: false, message: "Audio must be sampled at 16 kHz." };
  if (format.blockAlign !== 2 || format.byteRate !== 32000) return { valid: false, message: "The WAV audio format is inconsistent with 16 kHz mono PCM16." };

  const durationSeconds = dataBytes / format.byteRate;
  if (durationSeconds > MAX_DIAGNOSIS_AUDIO_SECONDS + 0.05) {
    return { valid: false, message: "Audio recordings must be 15 seconds or shorter." };
  }
  return { valid: true, file, durationSeconds };
}

export async function validateDiagnosisImage(file: File): Promise<MediaValidation> {
  if (file.size === 0) return { valid: false, message: "The image file is empty." };
  if (file.size > MAX_DIAGNOSIS_IMAGE_BYTES) return { valid: false, message: "Images must be 1.5 MB or smaller." };
  const nameIsJpeg = /\.jpe?g$/i.test(file.name);
  const mimeIsJpeg = file.type === "image/jpeg";
  if (!nameIsJpeg || !mimeIsJpeg) return { valid: false, message: "Upload a JPEG image (.jpg or .jpeg) only." };
  const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 2)).arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || tail[0] !== 0xff || tail[1] !== 0xd9) {
    return { valid: false, message: "The image does not contain a complete JPEG signature." };
  }
  return { valid: true, file };
}
