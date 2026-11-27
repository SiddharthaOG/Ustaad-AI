"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";

type Mode = "diagnose" | "billing";
type LineItem = { id: number; name: string; kind: "Part" | "Labour"; price: number };

const initialItems: LineItem[] = [
  { id: 1, name: "Capacitor 35µF", kind: "Part", price: 450 },
  { id: 2, name: "Inspection & fitting", kind: "Labour", price: 350 },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("diagnose");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioName, setAudioName] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [items, setItems] = useState(initialItems);
  const [customer, setCustomer] = useState("Ramesh Kumar");
  const [job, setJob] = useState("AC is running, but not cooling properly");
  const [showResult, setShowResult] = useState(true);
  const [notice, setNotice] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startRecording = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(media);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        setAudioName(`Voice note · ${(blob.size / 1024).toFixed(0)} KB`);
        media.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setSeconds((value) => {
          if (value >= 14) {
            if (timer.current) clearInterval(timer.current);
            recorder.current?.stop();
            setRecording(false);
            return 15;
          }
          return value + 1;
        });
      }, 1000);
    } catch {
      setNotice("Microphone access is unavailable. Check browser permissions or upload an audio file.");
    }
  };

  const stopRecording = () => {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  };

  const total = items.reduce((sum, item) => sum + item.price, 0);
  const addItem = () => setItems((current) => [...current, { id: Date.now(), name: "New line item", kind: "Part", price: 0 }]);
  const updateItem = (id: number, patch: Partial<LineItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const removeItem = (id: number) => setItems((current) => current.filter((item) => item.id !== id));

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
                  <div className={`record-zone ${recording ? "is-recording" : ""}`}>
                    <button className={`record-button ${recording ? "recording" : ""}`} onClick={recording ? stopRecording : startRecording} aria-label={recording ? "Stop recording" : "Start recording"}><span>{recording ? "■" : "🎙"}</span></button>
                    <strong>{recording ? "Listening… tap to stop" : audioName ? "Voice note captured" : "Tap to speak"}</strong>
                    <small>{recording ? `00:${String(seconds).padStart(2, "0")} / 00:15` : audioName || "Up to 15 seconds · Speak naturally"}</small>
                    {recording && <div className="waveform">{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ height: `${10 + ((i * 17) % 28)}px` }} />)}</div>}
                  </div>
                  <div className="or-divider"><span /> OR <span /></div>
                  <button className="upload-audio" onClick={() => audioInput.current?.click()}><Icon>↑</Icon><span><strong>Upload an audio clip</strong><small>WAV, MP3 or M4A · Max 2 MB</small></span><b>Browse files</b></button>
                  <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => setAudioName(e.target.files?.[0]?.name || "")} />
                  <div className="photo-row"><div className="photo-icon">▧</div><div><strong>Add a photo <em>OPTIONAL</em></strong><small>A photo of the unit or its error code helps.</small>{photoName && <small className="file-picked">✓ {photoName}</small>}</div><button onClick={() => photoInput.current?.click()}>{photoName ? "Change photo" : "+ Add photo"}</button><input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => setPhotoName(e.target.files?.[0]?.name || "")} /></div>
                  <button className="primary-button full-button" onClick={() => { setShowResult(true); setNotice("Demo result shown below. Live diagnosis will connect when the backend API is ready."); }}>Analyse the problem <span>→</span></button>
                  <div className="privacy-note"><Icon>♢</Icon> Your recordings and photos are processed for this request, not stored.</div>
                </section>

                <section className="panel result-panel">
                  <div className="result-top"><div><span className="step-label">STEP 02 · USTAAD’S FINDINGS</span><h2>Diagnosis overview</h2></div><span className="demo-tag">SAMPLE RESULT</span></div>
                  {showResult ? <><div className="fault-title"><div className="fault-icon">⌁</div><div><strong>Possible capacitor issue</strong><small>AC runs, but cooling is weak or absent</small></div><span className="confidence">Needs verification</span></div><div className="safety-alert"><span className="safety-symbol">!</span><div><strong>Safety first</strong><p>Switch off the unit at the mains before opening the panel. Capacitors can retain a dangerous electrical charge even after power is disconnected.</p></div></div><div className="steps-heading">Suggested checks <span>UP TO 4 STEPS</span></div><ol className="repair-steps"><li><span>1</span><div><strong>Isolate the power supply</strong><p>Turn off the MCB and verify the unit is de-energised.</p></div></li><li><span>2</span><div><strong>Inspect the capacitor</strong><p>Look for bulging, leakage or visible damage. Do not touch terminals.</p></div></li><li><span>3</span><div><strong>Test capacitance</strong><p>Use a suitable meter and compare the reading with the rated value.</p></div></li></ol><div className="source-note"><span>ⓘ</span> Sample interface only — no fault code has been verified for a specific model.</div></> : <div className="empty-result">Your diagnosis will appear here after analysis.</div>}
                </section>
              </div>

              <aside className="right-column">
                <section className="panel quick-panel"><div className="quick-head"><span>✳</span><strong>Ustaad’s approach</strong></div><h3>Clarity before repairs.</h3><p>We’ll help you narrow down the fault, not throw random fixes at it.</p><div className="quick-point"><b>01</b><span><strong>Grounded answers</strong><small>Based on verified service information.</small></span></div><div className="quick-point"><b>02</b><span><strong>Safety comes first</strong><small>Warnings before any repair steps.</small></span></div><div className="quick-point"><b>03</b><span><strong>You stay in control</strong><small>Confirm before taking action.</small></span></div></section>
                <section className="tip-card"><div className="tip-top"><span>✦ FIELD TIP</span><span>01 / 03</span></div><p>“Describe what the machine is doing — not just what you think is broken.”</p><small>Better symptoms lead to better troubleshooting.</small></section>
                <div className="support-line"><span>◉</span> Built for the people who keep India running.</div>
              </aside>
            </div>
          ) : (
            <div className="billing-layout">
              <section className="panel bill-capture">
                <div className="panel-heading"><div><span className="step-label">STEP 01 · DESCRIBE THE JOB</span><h2>What work did you do?</h2></div><span className="voice-badge"><span className="pulse" /> VOICE FIRST</span></div>
                <p className="panel-copy">Say the parts used and labour charged. You can edit every line before sharing.</p>
                <textarea value={job} onChange={(e) => setJob(e.target.value)} aria-label="Job description" />
                <div className="bill-voice-row"><button className="small-record" onClick={recording ? stopRecording : startRecording}>{recording ? "■ Stop" : "🎙 Speak"}</button><span>{recording ? `Recording · 00:${String(seconds).padStart(2, "0")}` : "Or type the job details above"}</span><button className="text-action" onClick={() => setNotice("Demo bill extraction refreshed from the sample description.")}>Extract items →</button></div>
              </section>
              <section className="panel bill-editor">
                <div className="bill-title-row"><div><span className="step-label">STEP 02 · REVIEW & CONFIRM</span><h2>Itemised bill</h2></div><span className="draft-tag">DRAFT</span></div>
                <div className="customer-field"><label htmlFor="customer">CUSTOMER NAME</label><input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
                <div className="items-header"><span>DESCRIPTION</span><span>TYPE</span><span>AMOUNT (₹)</span><span /></div>
                {items.map((item) => <div className="item-row" key={item.id}><input aria-label="Item description" value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} /><select aria-label="Item type" value={item.kind} onChange={(e) => updateItem(item.id, { kind: e.target.value as LineItem["kind"] })}><option>Part</option><option>Labour</option></select><input aria-label="Item price" type="number" min="0" value={item.price} onChange={(e) => updateItem(item.id, { price: Number(e.target.value) })} /><button className="remove-item" onClick={() => removeItem(item.id)} aria-label="Remove item">×</button></div>)}
                <button className="add-item" onClick={addItem}>＋ Add line item</button>
                <div className="bill-total"><div><span>Subtotal</span><strong>₹{total.toLocaleString("en-IN")}</strong></div><div><span>GST</span><span className="muted">Not included</span></div><div className="grand-total"><span>Total due</span><strong>₹{total.toLocaleString("en-IN")}</strong></div></div>
                <div className="bill-warning"><span>ⓘ</span> Review all prices before sharing. This is a draft; the backend will validate the final calculation.</div>
                <button className="primary-button full-button" onClick={() => setNotice("Demo only: the bill is ready for review. WhatsApp sharing will be enabled after API integration.")}>Prepare WhatsApp bill <span>↗</span></button>
                <p className="no-gst">No GST included · Prices are editable</p>
              </section>
            </div>
          )}
          {notice && <div className="toast" role="status"><span>ⓘ</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
          <footer className="footer"><span>© 2026 Ustaad AI</span><span>Made for the hands that make things work <b>✳</b></span><span>Version 0.1 · Prototype</span></footer>
        </div>
      </section>
    </main>
  );
}
