import type { DiagnosisResponse } from "@/lib/api/contracts";

type Props = {
  result: DiagnosisResponse | null;
  loading: boolean;
  error: string;
  hasSubmitted: boolean;
  warnings?: string[];
  onRetry?: () => void;
  onSpeak?: () => void;
  speechLoading?: boolean;
  speechError?: string;
  speechAudioUrl?: string;
  isDemo?: boolean;
  safetyFirst?: boolean;
  foodSafety?: boolean;
};

export function DiagnosisResult({ result, loading, error, hasSubmitted, warnings = [], onRetry, onSpeak, speechLoading = false, speechError = "", speechAudioUrl = "", isDemo = false, safetyFirst = false, foodSafety = false }: Props) {
};

export function DiagnosisResult({
  result, loading, error, hasSubmitted, warnings = [], onRetry, onSpeak,
  speechLoading = false, speechError = "", speechAudioUrl = "",
}: Props) {
  return (
    <section className={`panel result-panel ${isDemo ? "is-demo-result" : ""}`} aria-labelledby="diagnosis-heading" aria-live="polite">
      <div className="result-top">
        <div>
          <span className="step-label">STEP 02 · USTAAD’S FINDINGS</span>
          <h2 id="diagnosis-heading">Diagnosis overview</h2>
        </div>
        {result && <span className={result.grounded ? "grounded-tag" : "unverified-tag"}>{result.grounded ? (isDemo ? "SAMPLE REFERENCE" : "VERIFIED SOURCE") : "NEEDS VERIFICATION"}</span>}
        {loading && <span className="loading-tag">ANALYSING</span>}
      </div>

      {loading ? (
        <div className="diagnosis-state" role="status">
          <span className="diagnosis-spinner" />
          <strong>Ustaad is examining the symptoms…</strong>
          <p>This can take a few seconds. Keep this page open.</p>
        </div>
      ) : error ? (
        <div className="diagnosis-error" role="alert">
          <strong>We couldn’t complete the diagnosis.</strong>
          <p>{error}</p>
          <small>Your recording stays here. Check the connection and try again.</small>
          {onRetry && <button type="button" className="diagnosis-retry" onClick={onRetry}>Retry with the same recording</button>}
        </div>
      ) : !result ? (
        <div className="empty-result">
          {hasSubmitted ? "Your diagnosis will appear here when the analysis is complete." : "Your findings will appear here after you describe the problem and select Analyse."}
        </div>
      ) : (
        <>
          {warnings.length > 0 && <div className="diagnosis-response-warning" role="status"><strong>Incomplete response</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
          <div className="fault-title">
            <div className="fault-icon">⌁</div>
            <div>
              <strong>{result.detected_code ? "Extracted equipment code: " + result.detected_code : (safetyFirst ? "No verified diagnosis displayed" : result.error_meaning || "No specific fault code identified")}</strong>
              <small>{safetyFirst ? "A qualified technician must assess the equipment." : result.error_meaning || (result.grounded ? "Matched against verified service information." : "The available information is not enough to verify a specific fault.")}</small>
            </div>
            <span className={result.grounded ? "confidence verified-confidence" : "confidence"}>{result.grounded ? "Grounded" : "Unverified"}</span>
          </div>

          {safetyFirst && <div className="scenario-safety-callout" role="alert"><strong>Safety-first mode · no DIY repair instructions</strong><p>This scenario deliberately withholds repair steps. Do not touch exposed wiring, bypass safety devices or open electrical/refrigerant circuits. Stop work and arrange assessment by a qualified technician.</p></div>}
          {foodSafety && <div className="scenario-safety-callout" role="status"><strong>Protect the stored food</strong><p>Move perishable stock to verified working refrigeration or approved cold storage, minimise door opening and follow applicable local food-safety guidance. Do not rely on smell or appearance to decide whether food is safe.</p></div>}
          {foodSafety && !result.grounded && <div className="source-note" role="status">No refrigerator-specific grounded result is available from this response. Ustaad will not reuse air-conditioner guidance to invent a refrigerator fault meaning or repair procedure. Escalate to a qualified refrigeration technician.</div>}
          {result.detected_code && <div className="source-note code-extraction-note"><strong>Equipment code extracted: {result.detected_code}</strong><p>The code came from the diagnosis response. Its meaning is actionable only when matched to the exact equipment make and model.</p></div>}
          <div className="diagnosis-transcript">
            <strong>What Ustaad heard</strong>
            <p>{result.transcript || "No transcript was returned. Please verify the recording or provide the symptoms again."}</p>
          </div>

          {result.safety_alert?.trim() && (
            <div className="safety-alert" role="alert">
              <span className="safety-symbol">!</span>
              <div><strong>Safety first</strong><p>{result.safety_alert}</p></div>
            </div>
          )}

          {result.needs_confirmation && result.confirm_question && (
            <div className="confirmation-question">
              <strong>Ustaad needs one more detail</strong>
              <p>{result.confirm_question}</p>
            </div>
          )}
          {result.needs_confirmation && <div className="source-note" role="status">Answer the clarification before following any repair steps. Ustaad has withheld those steps until the missing detail is confirmed.</div>}

          {result.photo_note && (
            <div className="photo-observation"><strong>Photo observation</strong><p>{result.photo_note}</p></div>
          )}

          {!safetyFirst && !(foodSafety && !result.grounded) && result.probable_causes.length > 0 && (
            <div className="causes-block">
              <div className="steps-heading">Possible causes <span>{result.grounded ? "FROM VERIFIED REFERENCE" : "UNCONFIRMED"}</span></div>
              {!result.grounded && <p className="unverified-note">These are possibilities, not confirmed faults. Verify the equipment model and symptoms before repair.</p>}
              <ul>{result.probable_causes.map((cause, index) => <li key={`${index}-${cause}`}>{cause}</li>)}</ul>
            </div>
          )}

          {!safetyFirst && result.grounded && result.steps.length > 0 && (
            <>
              <div className="steps-heading">Suggested checks <span>UP TO 4 STEPS</span></div>
              <ol className="repair-steps">
                {result.steps.slice(0, 4).map((step, index) => (
                  <li key={`${index}-${step}`}><span>{index + 1}</span><div><p>{step}</p></div></li>
                ))}
              </ol>
            </>
          )}

          {!result.grounded && (
            <div className="source-note"><span>ⓘ</span> No verifiable knowledge-base identity was returned. Do not treat this as a confirmed diagnosis. Repair steps are withheld until the fault can be verified.</div>
          )}
          {result.grounded && (result.source || result.kb_id) && (
            <div className="source-note"><span>ⓘ</span> Reference: {result.source || "Verified knowledge base"}{result.kb_id ? ` · ${result.kb_id}` : ""}</div>
          )}

          {!safetyFirst && !(foodSafety && !result.grounded) && result.spoken_summary && (
            <div className="spoken-summary">
              <div><strong>Ustaad’s summary</strong><p>{result.spoken_summary}</p></div>
              {onSpeak && <button type="button" onClick={onSpeak} disabled={speechLoading}>{speechLoading ? "Preparing audio..." : speechAudioUrl ? "Generate again" : "Listen"} <span>Play</span></button>}
              {speechError && <p className="speech-error" role="alert">{speechError}</p>}
              {speechAudioUrl && <audio className="speech-player" controls autoPlay preload="auto" src={speechAudioUrl}>Audio playback is not supported by this browser.</audio>}
              {onSpeak && (
                <button type="button" onClick={onSpeak} disabled={speechLoading} aria-label="Generate spoken diagnosis">
                  {speechLoading ? "Preparing audio..." : speechAudioUrl ? "Generate again" : "Listen"}
                  <span aria-hidden="true">{speechLoading ? "..." : "Play"}</span>
                </button>
              )}
              {speechError && <p className="speech-error" role="alert">{speechError}</p>}
              {speechAudioUrl && (
                <div className="speech-playback" role="group" aria-label="Spoken diagnosis playback">
                  <span>Audio ready. Press play to listen</span>
                  <audio className="speech-player" controls preload="metadata" src={speechAudioUrl}>
                    Audio playback is not supported by this browser.
                  </audio>
                </div>
              )}
            </div>
          )}
          <div className="diagnosis-meta">{isDemo ? "Sample scenario · illustrative reference · not a live diagnosis" : "Processed by " + result.provider + " · " + Math.max(0, Math.round(result.latency_ms)) + " ms"}</div>
        </>
      )}
    </section>
  );
}
