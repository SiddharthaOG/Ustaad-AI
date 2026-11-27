import type { DiagnosisResponse } from "@/lib/api/contracts";

type Props = {
  result: DiagnosisResponse | null;
  loading: boolean;
  error: string;
  hasSubmitted: boolean;
  warnings?: string[];
  onRetry?: () => void;
  onSpeak?: () => void;
};

export function DiagnosisResult({ result, loading, error, hasSubmitted, warnings = [], onRetry, onSpeak }: Props) {
  return (
    <section className="panel result-panel" aria-labelledby="diagnosis-heading" aria-live="polite">
      <div className="result-top">
        <div>
          <span className="step-label">STEP 02 · USTAAD’S FINDINGS</span>
          <h2 id="diagnosis-heading">Diagnosis overview</h2>
        </div>
        {result && <span className={result.grounded ? "grounded-tag" : "unverified-tag"}>{result.grounded ? "VERIFIED SOURCE" : "NEEDS VERIFICATION"}</span>}
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
              <strong>{result.detected_code ? `Fault code: ${result.detected_code}` : result.error_meaning || "No specific fault code identified"}</strong>
              <small>{result.error_meaning || (result.grounded ? "Matched against verified service information." : "The available information is not enough to verify a specific fault.")}</small>
            </div>
            <span className={result.grounded ? "confidence verified-confidence" : "confidence"}>{result.grounded ? "Grounded" : "Unverified"}</span>
          </div>

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

          {result.photo_note && (
            <div className="photo-observation"><strong>Photo observation</strong><p>{result.photo_note}</p></div>
          )}

          {result.probable_causes.length > 0 && (
            <div className="causes-block">
              <div className="steps-heading">Possible causes <span>{result.grounded ? "FROM VERIFIED REFERENCE" : "UNCONFIRMED"}</span></div>
              {!result.grounded && <p className="unverified-note">These are possibilities, not confirmed faults. Verify the equipment model and symptoms before repair.</p>}
              <ul>{result.probable_causes.map((cause, index) => <li key={`${index}-${cause}`}>{cause}</li>)}</ul>
            </div>
          )}

          {result.grounded && result.steps.length > 0 && (
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
            <div className="source-note"><span>ⓘ</span> No verified knowledge-base match was returned. Do not treat this as a confirmed diagnosis. Repair steps are withheld until the fault can be verified.</div>
          )}
          {result.grounded && result.source && (
            <div className="source-note"><span>ⓘ</span> Reference: {result.source}{result.kb_id ? ` · ${result.kb_id}` : ""}</div>
          )}

          {result.spoken_summary && (
            <div className="spoken-summary">
              <div><strong>Ustaad’s summary</strong><p>{result.spoken_summary}</p></div>
              {onSpeak && <button type="button" onClick={onSpeak}>Listen <span>▶</span></button>}
            </div>
          )}
          <div className="diagnosis-meta">Processed by {result.provider} · {Math.max(0, Math.round(result.latency_ms))} ms</div>
        </>
      )}
    </section>
  );
}
