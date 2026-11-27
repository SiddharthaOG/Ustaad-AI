"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAudioRecorder } from "@/lib/audio/use-audio-recorder";
import { useLiveTranscript } from "@/lib/audio/use-live-transcript";
import { validateDiagnosisWav } from "@/lib/media-validation";
import { ustaadApi, UstaadApiError } from "@/lib/api/client";
import type { BillConfirmResponse, BillExtractionResponse, BillItem } from "@/lib/api/contracts";
import { demoBillExtraction, demoConfirmBill } from "@/lib/api/billing-demo";

type EditableBillItem = BillItem & { id: string };
type RecentBill = {
  id: string;
  savedAt: string;
  customer: string;
  items: BillItem[];
  unsupportedMentions: string[];
  confirmed: BillConfirmResponse | null;
  demoMode: boolean;
};
const STORAGE_KEY = "ustaad-ai:recent-bills:v1";
const money = (value: number | string) => Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function toEditableItems(items: BillItem[]): EditableBillItem[] {
  return items.filter((item) => !!item && typeof item === "object" &&
    typeof item.name === "string" && typeof item.qty === "string" && typeof item.unit === "string" &&
    (item.kind === "part" || item.kind === "labour")).map((item) => ({
      ...item,
      unit_price: typeof item.unit_price === "string" ? item.unit_price : null,
      needs_confirmation: item.needs_confirmation === true || item.unit_price === null || item.unit_price === undefined,
      id: makeId(),
    }));
}

function isBillConfirmResponse(value: unknown): value is BillConfirmResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<BillConfirmResponse>;
  return Array.isArray(result.items) && typeof result.total_complete === "boolean" &&
    (result.subtotal === null || typeof result.subtotal === "string") &&
    (result.total === null || typeof result.total === "string") &&
    (result.whatsapp_text === null || typeof result.whatsapp_text === "string") &&
    (result.total_complete ? typeof result.total === "string" && typeof result.whatsapp_text === "string" : result.total === null && result.whatsapp_text === null);
}

function isRecentBill(value: unknown): value is RecentBill {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentBill>;
  return typeof item.id === "string" && typeof item.savedAt === "string" &&
    typeof item.customer === "string" && Array.isArray(item.items) &&
    item.items.every((line) => !!line && typeof line.name === "string" && typeof line.qty === "string" &&
      typeof line.unit === "string" && (line.kind === "part" || line.kind === "labour") &&
      (line.unit_price === null || typeof line.unit_price === "string") && typeof line.needs_confirmation === "boolean") &&
    Array.isArray(item.unsupportedMentions) && item.unsupportedMentions.every((entry) => typeof entry === "string") &&
    typeof item.demoMode === "boolean" && (item.confirmed === null || typeof item.confirmed === "object");
}

export function BillingWorkflow({ active }: { active: boolean }) {
  const recorder = useAudioRecorder();
  const liveText = useLiveTranscript();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [customer, setCustomer] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [liveTextEnabled, setLiveTextEnabled] = useState(false);
  const [items, setItems] = useState<EditableBillItem[]>([]);
  const [unsupportedMentions, setUnsupportedMentions] = useState<string[]>([]);
  const [extractionTranscript, setExtractionTranscript] = useState("");
  const [provider, setProvider] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const extractSubmitting = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmedBill, setConfirmedBill] = useState<BillConfirmResponse | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [recentBills, setRecentBills] = useState<RecentBill[]>([]);

  const audioUrl = recorder.audioUrl || uploadedUrl;
  const recorderStatus = recorder.status;
  const stopLiveText = liveText.stop;
  const stopBillingRecorder = recorder.stop;
  const clearBillingRecorder = recorder.clear;
  const recording = recorderStatus === "recording";
  const missingPrices = items.filter((item) => item.needs_confirmation || item.unit_price === null).length;
  const estimateComplete = items.length > 0 && missingPrices === 0;
  const estimate = useMemo(() => items.reduce((sum, item) => {
    if (item.unit_price === null || item.needs_confirmation) return sum;
    const qty = Number(item.qty);
    const price = Number(item.unit_price);
    return Number.isFinite(qty) && Number.isFinite(price) ? sum + qty * price : sum;
  }, 0), [items]);

  useEffect(() => () => { if (uploadedUrl) URL.revokeObjectURL(uploadedUrl); }, [uploadedUrl]);

  useEffect(() => {
    if (active) return;
    stopLiveText();
    if (recorderStatus === "recording") void stopBillingRecorder();
    else if (recorderStatus === "requesting") clearBillingRecorder();
  }, [active, recorderStatus, stopBillingRecorder, clearBillingRecorder, stopLiveText]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (!cancelled && Array.isArray(stored)) setRecentBills(stored.filter(isRecentBill).slice(0, 10));
      } catch {
        if (!cancelled) setRecentBills([]);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const clearUploaded = () => {
    setUploadedFile(null);
    setUploadedUrl("");
    setFileError("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const startRecording = () => {
    clearUploaded();
    setItems([]); setUnsupportedMentions([]); setExtractionTranscript(""); setConfirmedBill(null); setNotice("");
    setJobDescription("");
    setError("");
    void recorder.start();
    liveText.clear();
    if (liveTextEnabled) liveText.start(language === "hi" ? "hi-IN" : "en-IN");
  };

  const stopRecording = () => {
    void recorder.stop();
    liveText.stop();
  };

  const clearRecording = () => {
    liveText.stop();
    liveText.clear();
    recorder.clear();
    clearUploaded();
  };

  const handleUpload = async (file?: File) => {
    if (!file) return;
    liveText.stop();
    liveText.clear();
    setJobDescription("");
    recorder.clear();
    setItems([]); setUnsupportedMentions([]); setExtractionTranscript(""); setConfirmedBill(null); setNotice("");
    const result = await validateDiagnosisWav(file);
    if (!result.valid) {
      setFileError(result.message);
      setUploadedFile(null);
      setUploadedUrl("");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFileError("");
    setUploadedFile(result.file);
    setUploadedUrl(URL.createObjectURL(result.file));
  };

  const applyExtraction = (response: BillExtractionResponse, isDemo: boolean) => {
    if (!response || !Array.isArray(response.items)) {
      setError("The extraction service returned an incomplete response. Please retry.");
      return;
    }
    const editableItems = toEditableItems(response.items);
    const omittedCount = response.items.length - editableItems.length;
    setItems(editableItems);
    const mentions = Array.isArray(response.unsupported_mentions) ? response.unsupported_mentions.filter((entry) => typeof entry === "string") : [];
    setUnsupportedMentions(omittedCount ? [...mentions, `${omittedCount} extracted row(s) were omitted because required fields were missing. Add them manually after review.`] : mentions);
    setExtractionTranscript(typeof response.transcript === "string" ? response.transcript : "");
    setCustomer(typeof response.customer === "string" ? response.customer : customer);
    setProvider(response.provider || (isDemo ? "demo-fixture" : "unknown"));
    setLatency(typeof response.latency_ms === "number" ? Math.max(0, response.latency_ms) : null);
    setConfirmedBill(null);
    setDemoMode(isDemo);
    setError("");
    setNotice(omittedCount ? `${omittedCount} incomplete row(s) were omitted. Complete the remaining lines and add omitted items manually.` : isDemo ? "Demo extraction loaded. Edit the items and confirm the prices to complete the sample bill." : "Items extracted. Review every line before confirming.");
  };

  const extractBill = async () => {
    if (extractSubmitting.current || loading) return;
    extractSubmitting.current = true;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const audio = recorder.audioBlob
        ? new File([recorder.audioBlob], "ustaad-bill-recording.wav", { type: "audio/wav" })
        : uploadedFile;
      if (!audio) {
        setError("Record a voice note or upload a PCM WAV file before extracting bill items.");
        return;
      }
      const validation = await validateDiagnosisWav(audio);
      if (!validation.valid) {
        setError(validation.message);
        return;
      }
      const response = await ustaadApi.extractBill({
        audio: validation.file,
        lang: language === "hi" ? "hi" : "en",
        customer_name: customer.trim() || undefined,
      }, { timeoutMs: 90_000 });
      applyExtraction(response, false);
    } catch (reason) {
      setError(reason instanceof UstaadApiError ? reason.message : reason instanceof Error ? reason.message : "Bill extraction failed. Please try again.");
    } finally {
      extractSubmitting.current = false;
      setLoading(false);
    }
  };

  const runDemoExtraction = () => {
    applyExtraction(demoBillExtraction, true);
    setJobDescription(demoBillExtraction.transcript);
  };

  const updateItem = (id: string, patch: Partial<BillItem>) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if (patch.unit_price !== undefined) next.needs_confirmation = patch.unit_price === null || patch.unit_price.trim() === "";
      return next;
    }));
    setConfirmedBill(null);
    setNotice(""); setError("");
  };

  const addItem = () => {
    setItems((current) => [...current, {
      id: makeId(), name: "", qty: "1", unit: "piece", unit_price: null,
      kind: "part", needs_confirmation: true,
    }]);
    setConfirmedBill(null);
    setNotice(""); setError("");
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setConfirmedBill(null);
    setNotice(""); setError("");
  };

  const confirmBill = async () => {
    if (items.length === 0) {
      setError("Add or extract at least one line item before confirming the bill.");
      return;
    }
    const invalid = items.find((item) => !item.name.trim() || !item.unit.trim() || !/^\d+(?:\.\d{1,3})?$/.test(item.qty) || Number(item.qty) <= 0 ||
      (item.unit_price !== null && !/^\d+(?:\.\d{1,2})?$/.test(item.unit_price)));
    if (invalid) {
      setError("Check each line: add a description, a positive quantity (up to 3 decimals), and a valid price (up to 2 decimals).");
      return;
    }
    setConfirming(true);
    setConfirmedBill(null);
    setError("");
    setNotice("");
    const demoItems: BillItem[] = items.map(({ name, qty, unit, unit_price, kind, needs_confirmation }) => ({ name, qty, unit, unit_price, kind, needs_confirmation }));
    const requestItems = demoItems.map(({ name, qty, unit, unit_price, kind }) => ({ name, qty, unit, unit_price, kind }));
    try {
      const response: unknown = demoMode
        ? demoConfirmBill(customer.trim() || null, demoItems)
        : await ustaadApi.confirmBill({
            customer: customer.trim() || null,
            items: requestItems,
            unsupported_mentions: unsupportedMentions,
          }, { timeoutMs: 30_000 });
      if (!isBillConfirmResponse(response)) throw new Error("The confirmation service returned an incomplete response. Please retry.");
      setConfirmedBill(response);
      if (!response.total_complete || response.total === null) {
        setNotice("The bill is saved as incomplete. Confirm every missing price before sharing.");
      } else {
        setNotice(demoMode ? "Demo confirmation complete. This is a simulated backend total." : "Backend confirmed the bill total.");
      }
    } catch (reason) {
      setError(reason instanceof UstaadApiError ? reason.message : reason instanceof Error ? reason.message : "Could not confirm the bill. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const saveDraft = () => {
    if (items.length === 0) {
      setNotice("Add or extract line items before saving a draft.");
      return;
    }
    const record: RecentBill = {
      id: makeId(),
      savedAt: new Date().toISOString(),
      customer,
      items: items.map((item) => ({ name: item.name, qty: item.qty, unit: item.unit, unit_price: item.unit_price, kind: item.kind, needs_confirmation: item.needs_confirmation })),
      unsupportedMentions,
      confirmed: confirmedBill,
      demoMode,
    };
    const updated = [record, ...recentBills].slice(0, 10);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setRecentBills(updated);
      setNotice("Draft saved on this device.");
    } catch {
      setNotice("Could not save this draft. Check browser storage availability.");
    }
  };

  const loadDraft = (bill: RecentBill) => {
    setCustomer(bill.customer);
    setItems(toEditableItems(bill.items));
    setUnsupportedMentions(bill.unsupportedMentions);
    setConfirmedBill(bill.confirmed);
    setDemoMode(bill.demoMode);
    setError("");
    setNotice("Draft restored.");
  };

  const deleteDraft = (id: string) => {
    const updated = recentBills.filter((bill) => bill.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setRecentBills(updated);
    } catch {
      setNotice("Could not update browser storage. The saved draft was not deleted.");
    }
  };

  const audioName = recorder.audioBlob ? "Recorded voice note" : uploadedFile?.name;

  return (
    <div className="billing-layout billing-workflow">
      <section className="panel bill-capture">
        <div className="panel-heading"><div><span className="step-label">STEP 01 · DESCRIBE THE JOB</span><h2>What work did you do?</h2></div><span className="voice-badge"><span className="pulse" /> VOICE FIRST</span></div>
        <p className="panel-copy">Say the parts used and labour charged. Review the extracted lines before confirming.</p>
        <div className="billing-customer-inline">
          <label htmlFor="bill-customer">CUSTOMER NAME</label>
          <input id="bill-customer" value={customer} disabled={loading || confirming} onChange={(event) => { setCustomer(event.target.value); setConfirmedBill(null); setNotice(""); }} placeholder="Customer name (optional)" />
        </div>
        <label className="billing-field-label" htmlFor="bill-job-notes">JOB NOTES / LIVE TRANSCRIPT</label>
        <textarea id="bill-job-notes" value={liveText.transcript || jobDescription} onChange={(event) => { setJobDescription(event.target.value); liveText.setTranscript(event.target.value); }} placeholder="Describe the work, parts used and labour charged…" rows={4} />
        <label className="billing-live-opt-in"><input type="checkbox" checked={liveTextEnabled} onChange={(event) => { setLiveTextEnabled(event.target.checked); if (event.target.checked && recording) liveText.start(language === "hi" ? "hi-IN" : "en-IN"); else if (!event.target.checked) liveText.stop(); }} /> Enable browser live transcript preview <span>(opt-in; browser speech provider may process audio)</span></label>
        <div className="billing-audio-controls">
          <button type="button" className={recording ? "small-record is-recording" : "small-record"} onClick={recording ? stopRecording : startRecording} disabled={loading || confirming || recorder.status === "requesting" || recorder.status === "processing"}>{recording ? "Stop recording" : "Record voice note"}</button>
          <span>{recording ? `Recording · 00:${String(recorder.seconds).padStart(2, "0")} / 00:15` : audioName || "Record or upload a voice note"}</span>
          <select aria-label="Bill language" disabled={loading || confirming} value={language} onChange={(event) => { const next = event.target.value as "hi" | "en"; setLanguage(next); if (recording && liveTextEnabled) { liveText.stop(); liveText.start(next === "hi" ? "hi-IN" : "en-IN"); } }}><option value="hi">Hindi / Hinglish</option><option value="en">English</option></select>
        </div>
        {(recording || recorder.status === "requesting") && <div className={`recording-signal ${recording ? "is-live" : "is-requesting"}`} role="status" aria-live="polite"><span className="recording-signal-dot" /><span className="recording-signal-label">{recording ? "Ustaad is listening" : "Connecting to your microphone…"}</span>{recording && <span className="recording-signal-hint">{recorder.inputLevel > 0.015 ? "Voice input detected" : "Speak to test your mic"}</span>}</div>}
        {recorder.error && <p className="billing-error" role="alert">{recorder.error}</p>}
        {liveText.transcriptError && <p className="billing-error" role="alert">{liveText.transcriptError}</p>}
        {fileError && <p className="billing-error" role="alert">{fileError}</p>}
        {audioUrl && <div className="audio-review"><strong>Review recording</strong><audio controls preload="metadata" src={audioUrl}>Audio playback is not supported.</audio><div className="audio-review-actions"><button type="button" disabled={loading || confirming} onClick={() => { clearRecording(); startRecording(); }}>Retake</button><button type="button" disabled={loading || confirming} onClick={clearRecording}>Clear</button></div></div>}
        <div className="billing-upload-row">
          <input ref={fileInput} type="file" accept=".wav,audio/wav" hidden disabled={loading || confirming} onChange={(event) => void handleUpload(event.target.files?.[0])} />
          <button type="button" className="upload-audio" disabled={loading || confirming} onClick={() => fileInput.current?.click()}><span><strong>Upload WAV audio</strong><small>PCM16 · 16 kHz mono · Max 2 MB · 15 sec</small></span><b>Browse</b></button>
          <button type="button" className="billing-demo-button" onClick={runDemoExtraction} disabled={loading || confirming}>Load demo extraction</button>
        </div>
        <button type="button" className="primary-button full-button" onClick={() => void extractBill()} disabled={loading || confirming || recording}>{loading ? "Extracting items…" : "Extract items from voice note"} <span>→</span></button>
        <p className="billing-privacy">Typed notes are for review. The extraction endpoint analyses the audio recording. Audio is not stored by this frontend.</p>
        {extractionTranscript && <div className="billing-extraction-transcript"><strong>Extraction transcript</strong><p>{extractionTranscript}</p>{provider && <small>{provider}{latency !== null ? ` · ${Math.round(latency)} ms` : ""}</small>}</div>}
      </section>

      <section className="panel bill-editor" aria-busy={loading || confirming}>
        <div className="bill-title-row"><div><span className="step-label">STEP 02 · REVIEW & CONFIRM</span><h2>Itemised bill</h2></div><span className="draft-tag">{confirmedBill?.total_complete ? (demoMode ? "DEMO CONFIRMED" : "CONFIRMED") : "DRAFT"}</span></div>
        {items.length === 0 ? (
          <div className="billing-empty"><strong>No items yet</strong><p>Record a job description or load the demo extraction to populate the bill.</p></div>
        ) : (
          <>
            <div className="billing-item-list">
              {items.map((item, index) => (
                <div className="billing-item" key={item.id}>
                  <div className="billing-item-heading"><strong>LINE {String(index + 1).padStart(2, "0")}</strong><button type="button" className="remove-item" disabled={loading || confirming} onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name || "line item"}`}>×</button></div>
                  <label>Description<input disabled={loading || confirming} value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} placeholder="Part or labour description" /></label>
                  <div className="billing-item-grid">
                    <label>Type<select disabled={loading || confirming} value={item.kind} onChange={(event) => updateItem(item.id, { kind: event.target.value as BillItem["kind"] })}><option value="part">Part</option><option value="labour">Labour</option></select></label>
                    <label>Quantity<input disabled={loading || confirming} type="number" min="0.001" step="0.001" value={item.qty} onChange={(event) => updateItem(item.id, { qty: event.target.value, })} /></label>
                    <label>Unit<input disabled={loading || confirming} value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} placeholder="piece, metre, job" /></label>
                    <label>Unit price (₹)<input disabled={loading || confirming} type="number" min="0" step="0.01" value={item.unit_price ?? ""} placeholder="Confirm price" onChange={(event) => updateItem(item.id, { unit_price: event.target.value === "" ? null : event.target.value })} /></label>
                  </div>
                  {(item.needs_confirmation || item.unit_price === null) && <p className="billing-price-warning" role="status">Price needs confirmation. This line is excluded from the estimate and final total.</p>}
                </div>
              ))}
            </div>
            <button type="button" className="add-item" onClick={addItem} disabled={loading || confirming}>＋ Add line item</button>
          </>
        )}
        {unsupportedMentions.length > 0 && <div className="billing-unsupported"><strong>Not added to bill</strong><ul>{unsupportedMentions.map((mention) => <li key={mention}>{mention}</li>)}</ul></div>}
        <div className="billing-totals" aria-live="polite">
          <div><span>Provisional estimate</span><strong>{estimateComplete ? `₹${money(estimate)}` : "Incomplete"}</strong></div>
          <small>{missingPrices ? `${missingPrices} line(s) need price confirmation. ` : ""}Browser estimate only; backend confirmation is authoritative. No GST included.</small>
          <div className="billing-confirmed-total"><span>{demoMode ? "Demo-confirmed total" : "Backend-confirmed total"}</span><strong>{confirmedBill?.total_complete && confirmedBill.total !== null ? `₹${money(confirmedBill.total)}` : "Not confirmed"}</strong></div>
        </div>
        {error && <div className="billing-error" role="alert">{error}</div>}
        {notice && <div className="billing-notice" role="status">{notice}</div>}
        <div className="billing-action-row">
          <button type="button" className="billing-secondary-button" onClick={saveDraft} disabled={items.length === 0 || loading || confirming}>Save draft</button>
          <button type="button" className="primary-button" onClick={() => void confirmBill()} disabled={items.length === 0 || confirming || loading}>{confirming ? "Confirming…" : "Confirm totals"} <span>→</span></button>
        </div>
        {confirmedBill?.whatsapp_text && (
          <a className="billing-whatsapp-link" href={`https://wa.me/?text=${encodeURIComponent(confirmedBill.whatsapp_text)}`} target="_blank" rel="noopener noreferrer">{demoMode ? "Open demo WhatsApp preview" : "Open WhatsApp bill"} <span>↗</span></a>
        )}
        <p className="no-gst">{demoMode ? "Demo confirmation is simulated; do not treat this as a production bill." : "No GST included · Share only after the backend confirms every price."}</p>
      </section>

      <section className="panel billing-recent">
        <div className="bill-title-row"><div><span className="step-label">LOCAL DEVICE STORAGE</span><h2>Recent bills</h2></div><span className="draft-tag">{recentBills.length} / 10</span></div>
        {recentBills.length === 0 ? <p className="billing-recent-empty">Saved drafts will appear here. They stay in this browser on this device.</p> : recentBills.map((bill) => (
          <div className="billing-recent-row" key={bill.id}>
            <div><strong>{bill.customer || "Unnamed customer"}</strong><small>{new Date(bill.savedAt).toLocaleString("en-IN")} · {bill.items.length} items{bill.demoMode ? " · Demo" : ""}</small></div>
            <button type="button" onClick={() => loadDraft(bill)} disabled={loading || confirming}>Open</button>
            <button type="button" className="recent-delete" disabled={loading || confirming} onClick={() => deleteDraft(bill.id)} aria-label="Delete saved draft">×</button>
          </div>
        ))}
      </section>
    </div>
  );
}
