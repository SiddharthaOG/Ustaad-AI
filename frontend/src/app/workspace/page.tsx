/* eslint react/no-unescaped-entities: off */
"use client";

import Link from "next/link";
import Image from "next/image";

import { useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "@/lib/audio/use-audio-recorder";
import { useLiveTranscript } from "@/lib/audio/use-live-transcript";
import { ustaadApi, UstaadApiError } from "@/lib/api/client";
import type { DiagnosisResponse, SupportedLanguage } from "@/lib/api/contracts";
import { validateDiagnosisImage, validateDiagnosisWav } from "@/lib/media-validation";
import { normalizeDiagnosisResponse } from "@/lib/api/diagnosis-response";
import { DiagnosisResult } from "./diagnosis-result";
import { BillingWorkflow } from "./billing-workflow";

type Mode = "diagnose" | "billing";
type ScenarioId = "rajesh" | "amit" | "imran";
const SCENARIOS: Record<ScenarioId, { mechanic:string; customer:string; initials:string; title:string; subtitle:string; problem:string; equipment:string; first:string; final:string; job:string; badge:string }> = {
rajesh:{mechanic:"Rajesh",customer:"Ramesh Kumar",initials:"RK",title:"The experienced mechanic",subtitle:"A familiar repair becomes a test of evidence.",problem:"Ramesh's split AC has stopped cooling. The outdoor unit is noisy, there is a burning smell, and he needs it checked before a long journey.",equipment:"LG split AC - read the exact model from the rating plate. Displayed code: CH67. Confirm applicability for the specific model.",first:"LG AC cooling nahi kar raha. Outdoor fan se awaaz aa rahi hai.",final:"Yeh LG split AC hai. Exact model rating plate par [read model] hai. Display par CH67 aa raha hai. Cooling nahi ho rahi aur outdoor fan rotate nahi kar raha. Thodi burning smell bhi report hui hai. Please match LG CH67 with the manufacturer reference and tell me what is confirmed and what needs a qualified inspection.",job:"LG split AC service visit for Ramesh Kumar: investigate cooling failure and outdoor fan fault CH67. Check exact model applicability and safety before any repair.",badge:"EXPERIENCED TECHNICIAN"},
amit:{mechanic:"Amit",customer:"Amit Verma",initials:"AV",title:"The unqualified DIY repair",subtitle:"A homeowner wants a quick fix, but the safest answer may be to stop.",problem:"Amit's home AC has stopped cooling. He has opened the electrical cover and is considering bypassing a safety switch after watching a video.",equipment:"Home split AC · make/model and code unknown. Do not touch exposed wiring or bypass safety devices.",first:"Mera AC cooling nahi kar raha. Main khud theek karne ki koshish kar raha hoon.",final:"Main trained technician nahi hoon. AC cooling nahi kar raha. Maine electrical cover khola hai aur video mein safety switch bypass karne ko bola gaya. Kya main wires connect kar sakta hoon? Tell me what is safe and when I must stop and call a qualified technician.",job:"Amit Verma's home AC: document cooling failure and unsafe DIY intent. No DIY repair or safety-device bypass is authorised. Handoff is for a qualified technician inspection.",badge:"HOMEOWNER · NOT A TECHNICIAN"},
imran:{mechanic:"Imran",customer:"Farah Khan",initials:"IF",title:"The refrigerator cooling failure",subtitle:"A commercial refrigerator problem where product safety matters as much as repair.",problem:"Farah's grocery shop refrigerator is not holding temperature. Dairy and perishable stock are inside, and the display shows a fault code.",equipment:"Commercial refrigerator · state make/model, displayed and target temperatures, duration, stock type and exact code.",first:"Fridge thanda nahi kar raha. Display par warning aa rahi hai.",final:"Main Imran, technician hoon. Farah ki commercial refrigerator cooling maintain nahi kar rahi. Current temperature [reading], target [reading], duration [duration]. Dairy aur perishable stock andar hai. Brand/model [label] and display code [exact code]. Separate confirmed facts from possible causes and include food-safety precautions.",job:"Commercial refrigerator service for Farah Khan: record make/model, temperatures, duration, fault code and stock. Prioritise food safety; sample bill items are illustrative.",badge:"REFRIGERATION TECHNICIAN"}
};

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
  const [diagnosisIsDemo, setDiagnosisIsDemo] = useState(false);
  const [workshopTourStep, setWorkshopTourStep] = useState(-1);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>("rajesh");
  const [roleplayRunId, setRoleplayRunId] = useState(0);
  const [tourPlaybackHeard, setTourPlaybackHeard] = useState(false);
  const [billingContext, setBillingContext] = useState<{ customer: string; jobDescription: string } | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [diagnosisSubmitted, setDiagnosisSubmitted] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [speechAudioUrl, setSpeechAudioUrl] = useState("");
  const [notice, setNotice] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const diagnosisAbort = useRef<AbortController | null>(null);
  const diagnosisSubmitting = useRef(false);
  const speechSubmitting = useRef(false);
  const diagnosisSubmissionId = useRef(0);


  const audioUrl = recordedAudioUrl || uploadedAudioUrl;
  const scenario = SCENARIOS[selectedScenario];
  const coachTitles = ["","First, let the person explain.","Listen back before deciding.","Let's improve the recording.","Clear that take.","Now capture the useful details.","Review what you recorded.","Send the complaint for analysis.","Review Ustaad's response."];
  const coachDescriptions = ["","Say: " + scenario.first + " Then stop.","Your first recording is ready. Click Retake.","Record a clearer account, adding relevant details.","Click Clear to discard that take.","Final recording: " + scenario.final,"Play the recording and review it before proceeding.","Click Analyse. The actual recording goes to the connected API; it may ask for clarification rather than guess.","Review findings, grounding status, safety guidance and source. Then continue to sample billing."];


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("roleplay") !== "workshop") return;
    const requested = params.get("scenario");
    const timer = window.setTimeout(() => {
      if (requested === "amit" || requested === "imran" || requested === "rajesh") setSelectedScenario(requested);
      setWorkshopTourStep(-2);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => () => { if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl); }, [uploadedAudioUrl]);
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); }, [photoPreviewUrl]);
  useEffect(() => () => { if (speechAudioUrl) URL.revokeObjectURL(speechAudioUrl); }, [speechAudioUrl]);
  useEffect(() => () => { diagnosisAbort.current?.abort(); }, []);

  const cancelDiagnosisRequest = () => {
    diagnosisSubmissionId.current += 1;
    diagnosisSubmitting.current = false;

    const controller = diagnosisAbort.current;
    diagnosisAbort.current = null;
    controller?.abort();
    setDiagnosisLoading(false);

  };

  const beginRecording = () => {
    cancelDiagnosisRequest();
    setUploadedAudioUrl("");
    setUploadedAudioFile(null);
    setAudioName("");
    setAudioValidationError("");
    setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null);
    setDiagnosisWarnings([]);
    setDiagnosisError("");
    setDiagnosisSubmitted(false);
    void startRecording();
    if (liveTextEnabled) liveTranscript.start(transcriptLanguage);
  };
  const endRecording = () => { void stopRecording().then(() => { if (workshopTourStep === 1) setWorkshopTourStep(2); else if (workshopTourStep === 3) setWorkshopTourStep(4); else if (workshopTourStep === 5) { setTourPlaybackHeard(false); setWorkshopTourStep(6); } }); liveTranscript.stop(); };
  const clearAudio = () => {
    cancelDiagnosisRequest();
    liveTranscript.stop(); clearRecording(); liveTranscript.clear(); setUploadedAudioUrl(""); setUploadedAudioFile(null); setAudioName(""); setAudioValidationError(""); setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false);
    if (audioInput.current) audioInput.current.value = "";
  };
  const handleAudioFile = async (file?: File) => {
    if (!file) return;
    cancelDiagnosisRequest();
    liveTranscript.stop(); clearRecording(); setUploadedAudioUrl(""); setUploadedAudioFile(null); setAudioName(""); setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false);
    const validation = await validateDiagnosisWav(file);
    if (!validation.valid) { setAudioName(""); setAudioValidationError(validation.message); if (audioInput.current) audioInput.current.value = ""; return; }
    setUploadedAudioUrl(URL.createObjectURL(validation.file)); setUploadedAudioFile(validation.file); setAudioName(validation.file.name); setAudioValidationError("");
  };


  const analyseDiagnosis = async () => {
    if (diagnosisSubmitting.current || diagnosisLoading) return;
    diagnosisSubmitting.current = true;
    const submissionId = ++diagnosisSubmissionId.current;
    const audio = audioBlob
      ? new File([audioBlob], "ustaad-recording.wav", { type: "audio/wav" })
      : uploadedAudioFile;

    if (!audio) {
      setDiagnosisError("Record a voice note or upload an audio clip before analysing.");
      setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null);
      setDiagnosisSubmitted(false);
      diagnosisSubmitting.current = false;
      return;
    }
    let audioValidation: Awaited<ReturnType<typeof validateDiagnosisWav>>;
    try {
      audioValidation = await validateDiagnosisWav(audio);
    } catch {
      if (diagnosisSubmissionId.current === submissionId) {
        diagnosisSubmitting.current = false;
        setDiagnosisError("The selected audio file could not be read. Please choose it again.");
      }
      return;
    }
    if (diagnosisSubmissionId.current !== submissionId) return;
    if (!audioValidation.valid) {
      setDiagnosisError(audioValidation.message);
      setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null);
      setDiagnosisSubmitted(false);
      diagnosisSubmitting.current = false;
      return;
    }

    const controller = new AbortController();
    diagnosisAbort.current = controller;
    setDiagnosisLoading(true);
    setDiagnosisIsDemo(false);
    setDiagnosisError("");
    setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null);
    setDiagnosisSubmitted(true);
    try {
      const lang: SupportedLanguage = transcriptLanguage === "hi-IN" ? "hi" : "en";
      const response = await ustaadApi.diagnose(
        { audio: audioValidation.file, image: photoFile, lang },
        { signal: controller.signal, timeoutMs: 90_000 },
      );
      const normalized = normalizeDiagnosisResponse(response);
      setDiagnosis(normalized.result);
      setDiagnosisWarnings(normalized.warnings);
      if (workshopTourStep === 7) setWorkshopTourStep(8);
    } catch (error) {
      if (controller.signal.aborted) return;
      setDiagnosisError(
        error instanceof UstaadApiError
          ? error.message
          : error instanceof Error ? error.message : "Something went wrong while analysing the recording. Please try again.",
      );
    } finally {
      if (diagnosisAbort.current === controller) {
        diagnosisAbort.current = null;
        diagnosisSubmitting.current = false;
        setDiagnosisLoading(false);
      }
    }
  };

  const speakDiagnosis = async () => {
    if (!diagnosis?.spoken_summary || speechSubmitting.current) return;
    speechSubmitting.current = true;
    setSpeechLoading(true);
    setSpeechError("");
    try {
      const audio = await ustaadApi.speak({
        text: diagnosis.spoken_summary,
        lang: diagnosisIsDemo ? "en" : transcriptLanguage === "hi-IN" ? "hinglish" : "en",
      }, { timeoutMs: 60_000 });
      setSpeechAudioUrl(URL.createObjectURL(audio));
    } catch (error) {
      setSpeechError(
        error instanceof UstaadApiError
          ? error.message
          : error instanceof Error ? error.message : "Speech generation failed. Please try again.",
      );
    } finally {
      speechSubmitting.current = false;
      setSpeechLoading(false);
    }
  };

  const clearDiagnosis = () => {
    cancelDiagnosisRequest();
    clearAudio();
    setPhotoFile(null); setPhotoName(""); setPhotoValidationError(""); setPhotoPreviewUrl("");
    setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false);
    if (photoInput.current) photoInput.current.value = "";
  };

  const changeMode = (nextMode: Mode) => {
    if (nextMode === mode) return;
    if (mode === "diagnose") {
      cancelDiagnosisRequest();
      liveTranscript.stop();
      if (recorderStatus === "recording") void stopRecording();
      else if (recorderStatus === "requesting") clearRecording();
    }
    setMode(nextMode);
  };

  const handleModeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: Mode) => {
    let next: Mode | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = current === "diagnose" ? "billing" : "diagnose";
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = current === "diagnose" ? "billing" : "diagnose";
    if (event.key === "Home") next = "diagnose";
    if (event.key === "End") next = "billing";
    if (!next) return;
    event.preventDefault();
    changeMode(next);
    document.getElementById(next === "diagnose" ? "diagnose-tab" : "billing-tab")?.focus();
  };

  const continueToBilling = () => {
    setRoleplayRunId((current) => current + 1);
    setBillingContext({ customer: scenario.customer, jobDescription: scenario.job });
    setMode("billing");
  };

  return (
    <main className="app-shell">
      {workshopTourStep===-2 && <div className="workshop-intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="scenario-picker-title"><section className="workshop-intro-card scenario-picker-card"><span className="workshop-intro-kicker">USTAAD AI · THREE WORKSHOP STORIES</span><h2 id="scenario-picker-title">Choose a day in the workshop.</h2><p>Three people, three problems, one shared workflow.</p><div className="scenario-picker-grid">{(Object.keys(SCENARIOS) as ScenarioId[]).map((id)=>{const item=SCENARIOS[id];return <button type="button" key={id} className={"scenario-choice "+(selectedScenario===id?"is-selected":"")} onClick={()=>setSelectedScenario(id)}><span className="scenario-choice-initials">{item.initials}</span><span className="scenario-choice-badge">{item.badge}</span><strong>{item.title}</strong><small>{item.subtitle}</small><span className="scenario-choice-select">{selectedScenario===id?"SELECTED":"CHOOSE STORY"}</span></button>;})}</div><div className="workshop-intro-actions"><button type="button" className="workshop-secondary" onClick={()=>setWorkshopTourStep(-1)}>Not now</button><button type="button" className="workshop-primary" onClick={()=>{clearDiagnosis();setMode("diagnose");setWorkshopTourStep(0);}}>Continue with {scenario.mechanic} <span>-&gt;</span></button></div><small>Recording and diagnosis use the connected API. Billing uses labelled sample fixtures.</small></section></div>}
      {workshopTourStep===0 && <div className="workshop-intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="workshop-intro-title"><section className="workshop-intro-card"><span className="workshop-intro-kicker">USTAAD AI PRESENTS · {scenario.badge}</span><div className="workshop-intro-scene"><span className="workshop-scene-time">A DAY IN THE WORKSHOP</span><span className="workshop-scene-icon">{scenario.initials}</span><span className="workshop-scene-caption">{scenario.mechanic.toUpperCase()}'S STORY</span></div><h2 id="workshop-intro-title">You're {scenario.mechanic}. Here's today's job.</h2><p>{scenario.problem}</p><p className="workshop-intro-prompt">{scenario.equipment}</p><div className="workshop-intro-actions"><button type="button" className="workshop-secondary" onClick={()=>setWorkshopTourStep(-2)}>Back to stories</button><button type="button" className="workshop-primary" onClick={()=>setWorkshopTourStep(1)}>Enter the workshop <span>-&gt;</span></button></div><small>Only show a code meaning or repair step as verified when a grounded reference is returned.</small></section></div>}
      {workshopTourStep>=1 && workshopTourStep<=8 && <aside className="workshop-coach" role="status" aria-live="polite"><div className="workshop-coach-top"><span>{scenario.mechanic.toUpperCase()} · {scenario.customer.toUpperCase()}</span><span>{workshopTourStep}/8</span></div><div className="workshop-coach-progress"><i style={{width:(workshopTourStep/8*100)+'%'}} /></div><h3>{coachTitles[workshopTourStep]}</h3><p>{coachDescriptions[workshopTourStep]}</p>{workshopTourStep===6 && <button type="button" className="workshop-primary workshop-coach-action" disabled={!tourPlaybackHeard} onClick={()=>setWorkshopTourStep(7)}>{tourPlaybackHeard?"I've reviewed the recording":"Play the recording to continue"} <span>-&gt;</span></button>}{workshopTourStep===8 && <button type="button" className="workshop-primary workshop-coach-action" onClick={()=>{setWorkshopTourStep(-1);continueToBilling();}}>Continue to billing <span>-&gt;</span></button>}<button type="button" className="workshop-coach-skip" onClick={()=>setWorkshopTourStep(-1)}>Exit guided demo</button></aside>}<aside className="sidebar">
        <Link className="brand" href="/" aria-label="Ustaad AI home">
          <span className="brand-mark">u.</span>
          <span><strong>ustaad<span className="brand-ai">.ai</span></strong><small>THE WORKSHOP COPILOT</small></span>
        </Link>
        <div className="side-label">WORKSPACE</div>
        <button className={`side-link ${mode === "diagnose" ? "active" : ""}`} onClick={() => changeMode("diagnose")}><span className="icon" aria-hidden="true">01</span> Diagnose a fault <span className="side-arrow">&gt;</span></button>
        <button className={`side-link ${mode === "billing" ? "active" : ""}`} onClick={() => changeMode("billing")}><span className="icon" aria-hidden="true">02</span> Create a bill <span className="side-arrow">&gt;</span></button>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">?</span><strong>Need a hand?</strong><p>Your workshop assistant is ready when you are.</p><button onClick={() => setNotice("Help centre is coming soon.")}>Get help <span>-&gt;</span></button></div>
          <div className="profile"><div className="avatar">{scenario.initials}</div><div><strong>{scenario.mechanic}</strong><small>{scenario.badge}</small></div><span className="more"></span></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{mode === "diagnose" ? "Fault diagnosis" : "New bill"}</strong></div>
          <div className="topbar-right"><span className="status-dot" /> Diagnosis API connected <span className="top-divider" /> <button className="icon-button" aria-label="Notifications">!</button></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">WORKSHOP <span>*</span></div><h1>{mode === "diagnose" ? "What are we fixing today?" : "Let's get that bill ready."}</h1><p>{mode === "diagnose" ? "Tell Ustaad what is happening. We will work through it together." : "Speak the job details. Review the items, make changes, and share."}</p></div>
            <div className="date-chip"><span>*</span> Workshop workspace</div>
          </div>

          <div className="mode-switch" role="tablist" aria-label="Choose a workflow">
            <button id="diagnose-tab" role="tab" aria-controls="diagnosis-panel" aria-selected={mode === "diagnose"} className={mode === "diagnose" ? "selected" : ""} onClick={() => changeMode("diagnose")} onKeyDown={(event) => handleModeKeyDown(event, "diagnose")} tabIndex={mode === "diagnose" ? 0 : -1}><span>01</span> Diagnose</button>
            <button id="billing-tab" role="tab" aria-controls="billing-panel" aria-selected={mode === "billing"} className={mode === "billing" ? "selected" : ""} onClick={() => changeMode("billing")} onKeyDown={(event) => handleModeKeyDown(event, "billing")} tabIndex={mode === "billing" ? 0 : -1}><span>02</span> Make a bill</button>
          </div>

          {mode === "diagnose" ? (
            <>
            <section className="demo-launch panel" aria-labelledby="demo-launch-title">
              <div><span className="demo-launch-kicker">THREE INTERACTIVE STORIES</span><h2 id="demo-launch-title">A Day at the Workshop</h2><p>Choose an experienced mechanic, an unsafe DIY attempt or a commercial refrigerator fault.</p><small>Real recording and diagnosis API; scenario billing is simulated.</small></div>
              <button type="button" className="demo-launch-button" onClick={() => { clearDiagnosis(); setWorkshopTourStep(-2); }} disabled={diagnosisLoading}>Choose a story <span aria-hidden="true">-&gt;</span></button>
            </section>
            <div className="workspace-grid" id="diagnosis-panel" role="tabpanel" aria-labelledby="diagnose-tab">
              <div className="primary-column">
                <section className="panel capture-panel">
                  <div className="panel-heading"><div><span className="step-label">TELL US THE PROBLEM</span><h2>Talk to Ustaad</h2></div><span className="voice-badge"><span className="pulse" /> VOICE FIRST</span></div>
                  <p className="panel-copy">Describe the symptoms in Hindi, English or Hinglish.</p>
                  {workshopTourStep>=1 && workshopTourStep<=8 && <div className="scenario-recording-brief"><strong>{scenario.mechanic} · {scenario.customer}</strong><p>{scenario.equipment}</p>{selectedScenario==="rajesh" && <small>Read the exact make, model and displayed code aloud. The LG source pack maps CH67 to an outdoor-unit fan problem; confirm applicability for the exact model.</small>}{selectedScenario==="imran" && <small>Include displayed temperature, target temperature, duration and perishable stock.</small>}{selectedScenario==="amit" && <small>Do not touch exposed wiring, bypass a safety switch or open a refrigerant circuit.</small>}</div>}
                  {(recording || recorderStatus === "requesting") && <div className={`recording-signal ${recording ? "is-live" : "is-requesting"}`} role="status" aria-live="polite"><span className="recording-signal-dot" /><span className="recording-signal-label">{recording ? "Ustaad is listening" : "Connecting to your microphone..."}</span>{recording && <span className="input-meter" aria-label={inputLevel > 0.015 ? "Microphone input detected" : "Waiting for microphone input"}>{Array.from({ length: 12 }, (_, index) => <i key={index} className={inputLevel > (index + 1) / 16 ? "active" : ""} />)}</span>}{recording && <span className="recording-signal-hint">{inputLevel > 0.015 ? "Voice input detected" : "Speak to test your mic"}</span>}</div>}
                  <div className={`record-zone ${recording ? "is-recording" : ""} ${[1,3,5].includes(workshopTourStep) ? "tour-target" : ""}`}>
                    <button className={`record-button ${recording ? "recording" : ""}`} onClick={recording ? endRecording : beginRecording} disabled={recorderStatus === "requesting" || recorderStatus === "processing"} aria-label={recording ? "Stop recording" : "Start recording"}><span>{recording ? "?" : "?"}</span></button>
                    <strong>{recording ? "Listening... tap to stop" : audioBlob || audioName ? "Voice note captured" : "Tap to speak"}</strong>
                    <small>{recording ? `00:${String(seconds).padStart(2, "0")} / 00:15` : audioName || "Up to 15 seconds  Speak naturally"}</small>
                    {recording && <div className="waveform">{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ height: `${10 + ((i * 17) % 28)}px` }} />)}</div>}
                  </div>
                  {recorderError && <p className="file-picked" role="alert">{recorderError}</p>}
                  {audioValidationError && <p className="file-picked" role="alert">{audioValidationError}</p>}
                  {audioUrl && <div className={`audio-review ${workshopTourStep === 6 ? "tour-target" : ""}`}><div><strong>Review your audio</strong><small>Listen before sending it to Ustaad.</small></div><audio controls preload="metadata" src={audioUrl} onPlay={() => { if (workshopTourStep === 6) setTourPlaybackHeard(true); }}>Audio playback is not supported by this browser.</audio><div className="audio-review-actions"><button type="button" className={workshopTourStep === 2 ? "tour-target" : ""} onClick={() => { clearAudio(); beginRecording(); if (workshopTourStep === 2) setWorkshopTourStep(3); }}>Retake</button><button type="button" className={workshopTourStep === 4 ? "tour-target" : ""} onClick={() => { clearAudio(); if (workshopTourStep === 4) setWorkshopTourStep(5); }}>Clear</button></div></div>}
                  <section className="transcript-card" aria-label="Live transcript review"><div className="transcript-heading"><div><strong>Live transcript</strong><small>Optional browser transcript preview. The recording is analysed separately.</small></div><select aria-label="Transcription language" value={transcriptLanguage} onChange={(event) => setTranscriptLanguage(event.target.value as "hi-IN" | "en-IN")}><option value="hi-IN">Hindi</option><option value="en-IN">English</option></select></div><label className="transcript-opt-in"><input type="checkbox" checked={liveTextEnabled} onChange={(event) => { setLiveTextEnabled(event.target.checked); if (event.target.checked && recording) liveTranscript.start(transcriptLanguage); else if (!event.target.checked) liveTranscript.stop(); }} /> Enable live text preview</label><textarea value={liveTranscript.transcript} onChange={(event) => liveTranscript.setTranscript(event.target.value)} placeholder="Your words will appear here while you speak. You can edit them before continuing." rows={3} aria-label="Edit spoken transcript"/><div className="transcript-foot">{liveTranscript.interim && <span className="transcript-interim">Hearing: {liveTranscript.interim}</span>}{!liveTranscript.supported && <span>Live text is not supported in this browser; you can type here instead.</span>}{liveTranscript.transcriptError && <span role="status">{liveTranscript.transcriptError}</span>}<button type="button" onClick={liveTranscript.clear} disabled={!liveTranscript.transcript && !liveTranscript.interim}>Clear text</button></div></section>
                  <div className="or-divider"><span /> OR <span /></div>
                  <button className="upload-audio" onClick={() => audioInput.current?.click()}><span className="icon" aria-hidden="true">A</span><span><strong>Upload an audio clip</strong><small>PCM WAV  16 kHz mono  Max 2 MB</small></span><b>Browse files</b></button>
                  <input ref={audioInput} type="file" accept=".wav,audio/wav" hidden onChange={(e) => void handleAudioFile(e.target.files?.[0])} />
                  <div className="photo-row"><div className="photo-icon">+</div><div><strong>Add a photo <em>OPTIONAL</em></strong><small>JPEG only  Max 1.5 MB</small>{photoName && <small className="file-picked"> {photoName}</small>}{photoValidationError && <small className="file-picked" role="alert">{photoValidationError}</small>}</div><button type="button" onClick={() => photoInput.current?.click()}>{photoName ? "Change photo" : "+ Add photo"}</button><input ref={photoInput} type="file" accept="image/jpeg,.jpg,.jpeg" capture="environment" hidden onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; cancelDiagnosisRequest(); setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false); void (async () => { const validation = await validateDiagnosisImage(file); if (!validation.valid) { setPhotoValidationError(validation.message); setPhotoFile(null); setPhotoName(""); setPhotoPreviewUrl(""); if (photoInput.current) photoInput.current.value = ""; return; } setPhotoFile(validation.file); setPhotoName(validation.file.name); setPhotoValidationError(""); setPhotoPreviewUrl(URL.createObjectURL(validation.file)); setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false); })(); }} /></div>{photoPreviewUrl && <div className="photo-preview"><Image src={photoPreviewUrl} alt="Selected equipment for diagnosis" width={184} height={144} unoptimized /><button type="button" onClick={() => { cancelDiagnosisRequest(); setPhotoFile(null); setPhotoName(""); setPhotoPreviewUrl(""); setPhotoValidationError(""); setSpeechAudioUrl(""); setSpeechError(""); setDiagnosis(null); setDiagnosisWarnings([]); setDiagnosisError(""); setDiagnosisSubmitted(false); if (photoInput.current) photoInput.current.value = ""; }}>Remove photo</button></div>}
                  <button className={`primary-button full-button ${workshopTourStep === 7 ? "tour-target" : ""}`} onClick={() => { void analyseDiagnosis(); }} disabled={diagnosisLoading || recorderStatus === "recording" || recorderStatus === "requesting" || recorderStatus === "processing"}>{diagnosisLoading ? "Analysing..." : "Analyse the problem"} <span></span></button><div className="diagnosis-actions"><button type="button" onClick={clearDiagnosis}>Clear diagnosis</button></div>
                  <div className="privacy-note"><span className="icon" aria-hidden="true">i</span> Recordings are not stored by Ustaad.</div>
                </section>

                <DiagnosisResult result={diagnosis} loading={diagnosisLoading} error={diagnosisError} hasSubmitted={diagnosisSubmitted} warnings={diagnosisWarnings} onRetry={(audioBlob || uploadedAudioFile) ? () => void analyseDiagnosis() : undefined} onSpeak={selectedScenario==="amit"?undefined:()=>void speakDiagnosis()} speechLoading={speechLoading} speechError={speechError} speechAudioUrl={speechAudioUrl} isDemo={diagnosisIsDemo} safetyFirst={selectedScenario==="amit"} foodSafety={selectedScenario==="imran"} />
                {diagnosis && workshopTourStep === 8 && <div className="roleplay-result-actions"><span>Live diagnosis response - review before acting</span><button type="button" onClick={() => { setWorkshopTourStep(-1); continueToBilling(); }}>Continue {scenario.customer}'s job to billing <span></span></button></div>}
              </div>


            </div>
            </>
          ) : null}
          <div hidden={mode !== "billing"} id="billing-panel" role="tabpanel" aria-labelledby="billing-tab"><BillingWorkflow key={selectedScenario + "-" + roleplayRunId} active={mode === "billing"} initialCustomer={billingContext?.customer || ""} initialJobDescription={billingContext?.jobDescription || ""} startRoleplay={!!billingContext} roleplayVariant={selectedScenario} /></div>
          {notice && <div className="toast" role="status"><span>i</span>{notice}<button onClick={() => setNotice("")}>x</button></div>}
          <footer className="footer"><span>(c) 2026 Ustaad AI</span><span>Made for the hands that make things work <b>*</b></span><span>Version 0.1 - Prototype</span></footer>
        </div>
      </section>
    </main>
  );
}
