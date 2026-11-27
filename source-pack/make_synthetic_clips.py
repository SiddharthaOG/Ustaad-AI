#!/usr/bin/env python3
"""
Generate synthetic test clips for Ustaad AI from the CSV scripts, using Gemini TTS.
Test tooling only: keep this file and its output OUTSIDE the hackathon repo.

Setup:   pip install google-genai numpy
Env:     GEMINI_API_KEY=...            (your key)
         GEMINI_TTS_MODEL=...          (confirm the current TTS model name in AI Studio)
Run:     python make_synthetic_clips.py --csv-dir . --out synthetic_clips
Dry run: python make_synthetic_clips.py --dry-run     (no API calls, tone placeholders)

What you get per clip: <ID>_quiet_<voice>.wav (16 kHz mono) and <ID>_noisy_<voice>.wav,
plus manifest.csv with the expected code / KB id / total for scoring.
Synthetic speech is cleaner and more uniform than real technicians, so use it to test the
pipeline and matching logic, not to claim real-world accuracy.
"""
import argparse, csv, os, re, sys, wave
import numpy as np

SR_OUT = 16000
VOICES = ["Kore", "Puck", "Charon"]          # Gemini prebuilt voices; edit if unavailable
SECOND_SPEAKER_IDS = {"D01", "D06", "D11", "B03", "B05"}
NOISY_IDS = {"D01", "D04", "D11", "B03", "B10", "N01", "N02"}
STYLE = "Say this naturally and quickly, like an Indian AC technician speaking Hindi mixed with English, in a slightly noisy workplace: "

def clean_line(text):
    return re.sub(r"\([^)]*\)", "", text).strip()

def read_rows(csv_dir):
    rows = []
    for name in ("test_clips_diagnose.csv", "test_clips_billing.csv"):
        path = os.path.join(csv_dir, name)
        with open(path, newline="", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                rows.append(r)
    return rows

def write_wav(path, samples, sr):
    pcm = np.clip(samples, -1, 1)
    pcm = (pcm * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())

def resample(x, sr_in, sr_out):
    if sr_in == sr_out:
        return x
    n_out = int(round(len(x) * sr_out / sr_in))
    return np.interp(np.linspace(0, len(x) - 1, n_out), np.arange(len(x)), x)

def make_noise(n, sr, rng):
    """Brown-ish noise plus a 50 Hz hum: rough stand-in for a fan or street."""
    white = rng.standard_normal(n)
    brown = np.cumsum(white); brown -= brown.mean(); brown /= np.max(np.abs(brown)) + 1e-9
    t = np.arange(n) / sr
    hum = 0.3 * np.sin(2 * np.pi * 50 * t)
    out = brown + hum
    return out / (np.max(np.abs(out)) + 1e-9)

def mix_at_snr(speech, noise, snr_db):
    ps = np.mean(speech ** 2) + 1e-12
    pn = np.mean(noise ** 2) + 1e-12
    scale = np.sqrt(ps / (pn * 10 ** (snr_db / 10)))
    out = speech + scale * noise
    return out / max(1.0, np.max(np.abs(out)))

def load_noise_file(path, n, rng):
    with wave.open(path, "rb") as w:
        sr = w.getframerate(); ch = w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    if ch > 1: data = data.reshape(-1, ch).mean(axis=1)
    data = resample(data, sr, SR_OUT)
    if len(data) < n: data = np.tile(data, int(np.ceil(n / len(data))))
    start = rng.integers(0, len(data) - n + 1)
    return data[start:start + n]

def tts_gemini(client, model, voice, text):
    from google.genai import types
    resp = client.models.generate_content(
        model=model, contents=STYLE + text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)))))
    pcm = resp.candidates[0].content.parts[0].inline_data.data   # 24 kHz, 16-bit mono PCM
    x = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
    return resample(x, 24000, SR_OUT)

def tts_dry(text):
    t = np.arange(int(SR_OUT * (0.5 + 0.06 * len(text)))) / SR_OUT
    return 0.3 * np.sin(2 * np.pi * 220 * t)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", default=".")
    ap.add_argument("--out", default="synthetic_clips")
    ap.add_argument("--noise-file", help="optional 16-bit WAV of real background noise")
    ap.add_argument("--snr", type=float, default=10.0, help="noisy clips: speech-to-noise ratio in dB")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rng = np.random.default_rng(7)
    client, model = None, None
    if not a.dry_run:
        from google import genai
        model = os.environ.get("GEMINI_TTS_MODEL")
        if not model or not os.environ.get("GEMINI_API_KEY"):
            sys.exit("Set GEMINI_API_KEY and GEMINI_TTS_MODEL, or use --dry-run.")
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    manifest = []
    for r in read_rows(a.csv_dir):
        cid, line = r["id"], clean_line(r["say_this"])
        voices = [VOICES[0]] + ([VOICES[1]] if cid in SECOND_SPEAKER_IDS else [])
        for v in voices:
            try:
                speech = tts_dry(line) if a.dry_run else tts_gemini(client, model, v, line)
            except Exception as e:
                print(f"FAILED {cid} {v}: {e}"); continue
            speech = np.concatenate([np.zeros(int(0.5 * SR_OUT)), speech, np.zeros(int(0.3 * SR_OUT))])
            variants = [("quiet", speech)]
            if cid in NOISY_IDS:
                noise = load_noise_file(a.noise_file, len(speech), rng) if a.noise_file else make_noise(len(speech), SR_OUT, rng)
                variants.append(("noisy", mix_at_snr(speech, noise, a.snr)))
            for cond, audio in variants:
                fname = f"{cid}_{cond}_{v.lower()}.wav"
                write_wav(os.path.join(a.out, fname), audio, SR_OUT)
                manifest.append({"file": fname, "id": cid, "condition": cond, "voice": v, "text": line,
                                 "expected_code": r.get("expected_code", ""), "expected_kb_id": r.get("expected_kb_id", ""),
                                 "expected_total_rupees": r.get("expected_total_rupees", "")})
                print("wrote", fname)
    with open(os.path.join(a.out, "manifest.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["file","id","condition","voice","text","expected_code","expected_kb_id","expected_total_rupees"])
        w.writeheader(); w.writerows(manifest)
    print(f"done: {len(manifest)} files in {a.out}")

if __name__ == "__main__":
    main()
