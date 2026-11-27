"use client";

import Link from "next/link";
import Image from "next/image";

import { useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "@/lib/audio/use-audio-recorder";
import { useLiveTranscript } from "@/lib/audio/use-live-transcript";
import { ustaadApi, UstaadApiError } from "@/lib/api/client";
import type { DiagnosisResponse, SupportedLanguage } from "@/lib/api/contracts";
import { validateDiagnosisImage, validateDiagnosisWav } from "@/lib/media-validation";
import { diagnosisDemoScenarios, type DiagnosisDemoScenario } from "@/lib/api/diagnosis-scenarios";
import { normalizeDiagnosisResponse } from "@/lib/api/diagnosis-response";
import { DiagnosisResult } from "./diagnosis-result";
import { BillingWorkflow } from "./billing-workflow";

type Mode = "diagnose" | "billing";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("diagnose");
  const [audioName, setAudioName] = useState("");
  const { status: recorderStatus, seconds, inputLevel, audioBlob, audioUrl: recordedAudioUrl, error: recorderError, start: startRecording, stop: stopRecording, clear: clearRecording } = useAudioRecorder();
  const liveTranscript = useLiveTranscript();
  const [transcriptLanguage, setTranscriptLanguage] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState("");
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [audioValidationError, setAudioValidationError] = useState("");
  const [liveTextEnabled, setLiveTextEnabled] = useState(false);
  const recording = recorderStatus === "recording";
  const [photoName, setPhotoName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoValidationError, setPhotoValidationError] = useState("");
  const [diagnosis, setDiagnosis] = useState<DiagnosisResponse | null>(null);
  const [diagnosisWarnings, setDiagnosisWarnings] = useState<string[]>([]);
  const [demoScenario, setDemoScenario] = useState<DiagnosisDemoScenario>("verified-safety");
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [diagnosisSubmitted, setDiagnosisSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  const audioUrl = recordedAudioUrl || uploadedAudioUrl;
  useEffect(() => () => { if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl); }, [uploadedAudioUrl]);
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); }, [photoPreviewUrl]);

  const beginRecording = () => {
    setUploadedAudioUrl("");
    setUploadedAudioFile(null);
    setAudioName("");
    setAudioValidationError("");
    setDiagnosis(null);
    setDiagnosisWarnings([]);
    setDiagnosisError("");
    setDiagnosisSubmitted(false);
    void startRecording();
    if (liveTextEnabled) liveTranscript.start(transcriptLanguage);
  };
  const endRecording = () => { void stopRecording(); liveTranscript.stop(); };
  const clearAudio = () => {
    liveTranscript.stop(); clearRecording(); liveTranscript.clear(); setUploadedAudioUrl(""); setUploadedAudioFile(null); setAudioName(""); setAudioValidationError(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false);
    if (audioInput.current) audioInput.current.value = "";
  };
  const handleAudioFile = async (file?: File) => {
    if (!file) return;
    liveTranscript.stop(); clearRecording(); setUploadedAudioUrl(""); setUploadedAudioFile(null); setAudioName(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false);
    const validation = await validateDiagnosisWav(file);
    if (!validation.valid) { setAudioName(""); setAudioValidationError(validation.message); if (audioInput.current) audioInput.current.value = ""; return; }
    setUploadedAudioUrl(URL.createObjectURL(validation.file)); setUploadedAudioFile(validation.file); setAudioName(validation.file.name); setAudioValidationError("");
  };


  const analyseDiagnosis = async () => {
    const audio = audioBlob
      ? new File([audioBlob], "ustaad-recording.wav", { type: "audio/wav" })
      : uploadedAudioFile;

    if (!audio) {
      setDiagnosisError("Record a voice note or upload an audio clip before analysing.");
      setDiagnosis(null);
      setDiagnosisSubmitted(false);
      return;
    }
    const audioValidation = await validateDiagnosisWav(audio);
    if (!audioValidation.valid) {
      setDiagnosisError(audioValidation.message);
      setDiagnosis(null);
      setDiagnosisSubmitted(false);
      return;
    }

    setDiagnosisLoading(true);
    setDiagnosisError("");
    setDiagnosis(null);
    setDiagnosisSubmitted(true);
    try {
      const lang: SupportedLanguage = transcriptLanguage === "hi-IN" ? "hi" : "en";
      const response = await ustaadApi.diagnose(
        { audio: audioValidation.file, image: photoFile, lang },
        { timeoutMs: 90_000 },
      );
      const normalized = normalizeDiagnosisResponse(response);
      setDiagnosis(normalized.result);
      setDiagnosisWarnings(normalized.warnings);
    } catch (error) {
      setDiagnosisError(
        error instanceof UstaadApiError
          ? error.message
          : error instanceof Error ? error.message : "Something went wrong while analysing the recording. Please try again.",
      );
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const clearDiagnosis = () => {
    clearAudio();
    setPhotoFile(null); setPhotoName(""); setPhotoValidationError(""); setPhotoPreviewUrl("");
    setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false);
    if (photoInput.current) photoInput.current.value = "";
  };

  const runDiagnosisDemo = async () => {
    const scenario = diagnosisDemoScenarios[demoScenario];
    setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisSubmitted(true); setDiagnosisError("");
    if (scenario.error) {
      if (demoScenario === "timeout") {
        setDiagnosisLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1800));
        setDiagnosisLoading(false);
      }
      setDiagnosisError(scenario.error);
      return;
    }
    if (scenario.result) {
      const normalized = normalizeDiagnosisResponse(scenario.result);
      setDiagnosis(normalized.result); setDiagnosisWarnings(normalized.warnings);
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Ustaad AI home">
          <span className="brand-mark">u.</span>
          <span><strong>ustaad<span className="brand-ai">.ai</span></strong><small>THE WORKSHOP COPILOT</small></span>
        </Link>
        <div className="side-label">WORKSPACE</div>
        <button className={`side-link ${mode === "diagnose" ? "active" : ""}`} onClick={() => setMode("diagnose")}><Icon>⌕</Icon> Diagnose a fault <span className="side-arrow">↗</span></button>
        <button className={`side-link ${mode === "billing" ? "active" : ""}`} onClick={() => setMode("billing")}><Icon>▤</Icon> Create a bill <span className="side-arrow">↗</span></button>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">✳</span><strong>Need a hand?</strong><p>Your workshop assistant is ready when you are.</p><button onClick={() => setNotice("Help centre is coming soon.")}>Get help <span>↗</span></button></div>
          <div className="profile"><div className="avatar">RK</div><div><strong>Rajesh Kumar</strong><small>Workshop account</small></div><span className="more">···</span></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{mode === "diagnose" ? "Fault diagnosis" : "New bill"}</strong></div>
          <div className="topbar-right"><span className="status-dot" /> All systems operational <span className="top-divider" /> <button className="icon-button" aria-label="Notifications">♧</button></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">GOOD EVENING, RAJESH <span>✳</span></div><h1>{mode === "diagnose" ? "What are we fixing today?" : "Let’s get that bill ready."}</h1><p>{mode === "diagnose" ? "Tell Ustaad what’s happening. We’ll work through it together." : "Speak the job details. Review the items, make changes, and share."}</p></div>
            <div className="date-chip"><span>◷</span> Friday, 27 November</div>
          </div>

          <div className="mode-switch" role="tablist" aria-label="Choose a workflow">
            <button role="tab" aria-selected={mode === "diagnose"} className={mode === "diagnose" ? "selected" : ""} onClick={() => setMode("diagnose")}><span>⌕</span> Diagnose</button>
            <button role="tab" aria-selected={mode === "billing"} className={mode === "billing" ? "selected" : ""} onClick={() => setMode("billing")}><span>▤</span> Make a bill</button>
          </div>

          {mode === "diagnose" ? (
            <div className="workspace-grid">
              <div className="primary-column">
                <section className="panel capture-panel">
                  <div className="panel-heading"><div><span className="step-label">STEP 01 · TELL US THE PROBLEM</span><h2>Talk to Ustaad</h2></div><span className="voice-badge"><span className="pulse" /> VOICE FIRST</span></div>
                  <p className="panel-copy">Explain the symptoms in your own words. Hindi, English or Hinglish — whatever works.</p>
                  {(recording || recorderStatus === "requesting") && <div className={`recording-signal ${recording ? "is-live" : "is-requesting"}`} role="status" aria-live="polite"><span className="recording-signal-dot" /><span className="recording-signal-label">{recording ? "Ustaad is listening" : "Connecting to your microphone…"}</span>{recording && <span className="input-meter" aria-label={inputLevel > 0.015 ? "Microphone input detected" : "Waiting for microphone input"}>{Array.from({ length: 12 }, (_, index) => <i key={index} className={inputLevel > (index + 1) / 16 ? "active" : ""} />)}</span>}{recording && <span className="recording-signal-hint">{inputLevel > 0.015 ? "Voice input detected" : "Speak to test your mic"}</span>}</div>}
                  <div className={`record-zone ${recording ? "is-recording" : ""}`}>
                    <button className={`record-button ${recording ? "recording" : ""}`} onClick={recording ? endRecording : beginRecording} aria-label={recording ? "Stop recording" : "Start recording"}><span>{recording ? "■" : "🎙"}</span></button>
                    <strong>{recording ? "Listening… tap to stop" : audioBlob || audioName ? "Voice note captured" : "Tap to speak"}</strong>
                    <small>{recording ? `00:${String(seconds).padStart(2, "0")} / 00:15` : audioName || "Up to 15 seconds · Speak naturally"}</small>
                    {recording && <div className="waveform">{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ height: `${10 + ((i * 17) % 28)}px` }} />)}</div>}
                  </div>
                  {recorderError && <p className="file-picked" role="alert">{recorderError}</p>}
                  {audioValidationError && <p className="file-picked" role="alert">{audioValidationError}</p>}
                  {audioUrl && <div className="audio-review"><div><strong>Review your audio</strong><small>Listen before sending it to Ustaad.</small></div><audio controls preload="metadata" src={audioUrl}>Audio playback is not supported by this browser.</audio><div className="audio-review-actions"><button type="button" onClick={() => { clearAudio(); beginRecording(); }}>Retake</button><button type="button" onClick={clearAudio}>Clear</button></div></div>}
                  <section className="transcript-card" aria-label="Live transcript review"><div className="transcript-heading"><div><strong>Live transcript</strong><small>Browser speech preview only. The backend analyses the audio recording independently; verify names and model codes.</small></div><select aria-label="Transcription language" value={transcriptLanguage} onChange={(event) => setTranscriptLanguage(event.target.value as "hi-IN" | "en-IN")}><option value="hi-IN">Hindi</option><option value="en-IN">English</option></select></div><label className="transcript-opt-in"><input type="checkbox" checked={liveTextEnabled} onChange={(event) => { setLiveTextEnabled(event.target.checked); if (event.target.checked && recording) liveTranscript.start(transcriptLanguage); else if (!event.target.checked) liveTranscript.stop(); }} /> Enable live text preview <span>(Hindi / English preview; mixed speech may be imperfect. Your browser speech provider may process audio.)</span></label><textarea value={liveTranscript.transcript} onChange={(event) => liveTranscript.setTranscript(event.target.value)} placeholder="Your words will appear here while you speak. You can edit them before continuing." rows={3} aria-label="Edit spoken transcript"/><div className="transcript-foot">{liveTranscript.interim && <span className="transcript-interim">Hearing: {liveTranscript.interim}</span>}{!liveTranscript.supported && <span>Live text is not supported in this browser; you can type here instead.</span>}{liveTranscript.transcriptError && <span role="status">{liveTranscript.transcriptError}</span>}<button type="button" onClick={liveTranscript.clear} disabled={!liveTranscript.transcript && !liveTranscript.interim}>Clear text</button></div></section>
                  <div className="or-divider"><span /> OR <span /></div>
                  <button className="upload-audio" onClick={() => audioInput.current?.click()}><Icon>↑</Icon><span><strong>Upload an audio clip</strong><small>PCM WAV · 16 kHz mono · Max 2 MB</small></span><b>Browse files</b></button>
                  <input ref={audioInput} type="file" accept=".wav,audio/wav" hidden onChange={(e) => void handleAudioFile(e.target.files?.[0])} />
                  <div className="photo-row"><div className="photo-icon">▧</div><div><strong>Add a photo <em>OPTIONAL</em></strong><small>JPEG only · Max 1.5 MB</small>{photoName && <small className="file-picked">✓ {photoName}</small>}{photoValidationError && <small className="file-picked" role="alert">{photoValidationError}</small>}</div><button type="button" onClick={() => photoInput.current?.click()}>{photoName ? "Change photo" : "+ Add photo"}</button><input ref={photoInput} type="file" accept="image/jpeg,.jpg,.jpeg" hidden onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void (async () => { const validation = await validateDiagnosisImage(file); if (!validation.valid) { setPhotoValidationError(validation.message); setPhotoFile(null); setPhotoName(""); setPhotoPreviewUrl(""); if (photoInput.current) photoInput.current.value = ""; return; } setPhotoFile(validation.file); setPhotoName(validation.file.name); setPhotoValidationError(""); setPhotoPreviewUrl(URL.createObjectURL(validation.file)); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false); })(); }} /></div>{photoPreviewUrl && <div className="photo-preview"><Image src={photoPreviewUrl} alt="Selected equipment for diagnosis" width={184} height={144} unoptimized /><button type="button" onClick={() => { setPhotoFile(null); setPhotoName(""); setPhotoPreviewUrl(""); setPhotoValidationError(""); if (photoInput.current) photoInput.current.value = ""; }}>Remove photo</button></div>}
                  <button className="primary-button full-button" onClick={() => void analyseDiagnosis()} disabled={diagnosisLoading || recorderStatus === "recording" || recorderStatus === "requesting" || recorderStatus === "processing"}>{diagnosisLoading ? "Analysing…" : "Analyse the problem"} <span>→</span></button><div className="diagnosis-actions"><button type="button" onClick={clearDiagnosis}>Clear diagnosis</button><div className="demo-controls"><label htmlFor="diagnosis-demo">Demo scenario</label><select id="diagnosis-demo" value={demoScenario} onChange={(event) => setDemoScenario(event.target.value as DiagnosisDemoScenario)}>{Object.entries(diagnosisDemoScenarios).map(([key, scenario]) => <option key={key} value={key}>{scenario.label}</option>)}</select><button type="button" onClick={() => void runDiagnosisDemo()} disabled={diagnosisLoading}>Run demo</button></div></div>
                  <div className="privacy-note"><Icon>♢</Icon> Ustaad does not store recordings. Live text preview may use your browser speech provider.</div>
                </section>

                <DiagnosisResult result={diagnosis} loading={diagnosisLoading} error={diagnosisError} hasSubmitted={diagnosisSubmitted} warnings={diagnosisWarnings} onRetry={(audioBlob || uploadedAudioFile) ? () => void analyseDiagnosis() : undefined} />
              </div>

              <aside className="right-column">
                <section className="panel quick-panel"><div className="quick-head"><span>✳</span><strong>Ustaad’s approach</strong></div><h3>Clarity before repairs.</h3><p>We’ll help you narrow down the fault, not throw random fixes at it.</p><div className="quick-point"><b>01</b><span><strong>Grounded answers</strong><small>Based on verified service information.</small></span></div><div className="quick-point"><b>02</b><span><strong>Safety comes first</strong><small>Warnings before any repair steps.</small></span></div><div className="quick-point"><b>03</b><span><strong>You stay in control</strong><small>Confirm before taking action.</small></span></div></section>
                <section className="tip-card"><div className="tip-top"><span>✦ FIELD TIP</span><span>01 / 03</span></div><p>“Describe what the machine is doing — not just what you think is broken.”</p><small>Better symptoms lead to better troubleshooting.</small></section>
                <div className="support-line"><span>◉</span> Built for the people who keep India running.</div>
              </aside>
            </div>
          ) : (
            <BillingWorkflow />
          )}
          {notice && <div className="toast" role="status"><span>ⓘ</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
          <footer className="footer"><span>© 2026 Ustaad AI</span><span>Made for the hands that make things work <b>✳</b></span><span>Version 0.1 · Prototype</span></footer>
        </div>
      </section>
    </main>
  );
}
