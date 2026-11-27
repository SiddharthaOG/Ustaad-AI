export const ACCEPTED_AUDIO_TYPES = ["wav", "mp3", "m4a"] as const;
export type AcceptedAudioType = (typeof ACCEPTED_AUDIO_TYPES)[number];

export type AudioFileValidation =
  | { valid: true; format: AcceptedAudioType; file: File }
  | { valid: false; message: string };

export async function validateAudioFile(file: File, maxBytes = 2 * 1024 * 1024): Promise<AudioFileValidation> {
  if (file.size <= 0) return { valid: false, message: "This audio file is empty." };
  if (file.size > maxBytes) return { valid: false, message: "Audio files must be 2 MB or smaller." };

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_AUDIO_TYPES.includes(extension as AcceptedAudioType)) {
    return { valid: false, message: "Use a WAV, MP3 or M4A audio file." };
  }

  const header = new Uint8Array(await file.slice(0, Math.min(file.size, 16 * 1024)).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
  let detected: AcceptedAudioType | null = null;

  if (header.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") {
    detected = "wav";
    if (file.size < 44) return { valid: false, message: "The WAV file is incomplete or truncated." };
    if (header.length < 16) return { valid: false, message: "The WAV header is incomplete." };
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const chunk = ascii(12, 16);
    if (chunk !== "fmt ") return { valid: false, message: "The WAV file has an invalid format header." };
    if (header.length >= 22) {
      const codec = view.getUint16(20, true);
      if (![1, 3].includes(codec)) return { valid: false, message: "This WAV codec is not supported. Use PCM WAV, MP3 or M4A." };
    }
  } else if (header.length >= 4) {
    let frameStart = 0;
    if (ascii(0, 3) === "ID3" && header.length >= 10) {
      const tagSize = ((header[6] & 0x7f) << 21) | ((header[7] & 0x7f) << 14) | ((header[8] & 0x7f) << 7) | (header[9] & 0x7f);
      frameStart = 10 + tagSize;
    }
    for (let i = frameStart; i < header.length - 1; i += 1) {
      if (header[i] === 0xff && (header[i + 1] & 0xe0) === 0xe0 && ((header[i + 1] >> 1) & 0x03) !== 0) { detected = "mp3"; break; }
    }
    if (!detected && header.length >= 12 && ascii(4, 8) === "ftyp") {
      const brand = ascii(8, 12);
      if (["M4A ", "M4B ", "isom", "iso2", "mp42"].includes(brand)) detected = "m4a";
    }
  }

  if (!detected) return { valid: false, message: "The file contents do not look like a supported audio format." };
  if (detected !== extension) return { valid: false, message: `The file extension says ${extension.toUpperCase()}, but its contents look like ${detected.toUpperCase()}.` };
  return { valid: true, format: detected, file };
}
