import type {
  ApiErrorPayload, BillConfirmRequest, BillConfirmResponse, BillExtractionResponse,
  BillRequest, DiagnosisRequest, DiagnosisResponse, HealthResponse, SupportedLanguage,
  TtsRequest,
} from "./contracts";

const DEFAULT_TIMEOUT_MS = 30_000;

export class UstaadApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(status: number, payload: ApiErrorPayload | null, fallbackMessage: string) {
    super(payload?.error?.message ?? fallbackMessage);
    this.name = "UstaadApiError";
    this.status = status;
    this.code = payload?.error?.code ?? "UNKNOWN_ERROR";
    this.requestId = payload?.error?.request_id ?? null;
    this.details = payload?.error?.details ?? null;
  }
}

function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return (configured || "http://localhost:8000").replace(/\/+$/, "");
}

function createTimedSignal(parentSignal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

async function parseApiError(response: Response, fallback: string): Promise<UstaadApiError> {
  let payload: ApiErrorPayload | null = null;
  try { payload = (await response.json()) as ApiErrorPayload; } catch { /* non-JSON response */ }
  return new UstaadApiError(response.status, payload, fallback);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const timed = createTimedSignal(options.signal, options.timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      signal: timed.signal,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw await parseApiError(response, `Request failed (${response.status}). Please try again.`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof UstaadApiError) throw error;
    if (timed.signal.aborted) {
      const didTimeout = timed.signal.reason?.name === "TimeoutError";
      throw new UstaadApiError(
        didTimeout ? 408 : 0, null,
        didTimeout ? "The server took too long to respond. Please try again." : "The request was cancelled.",
      );
    }
    if (error instanceof TypeError) {
      throw new UstaadApiError(0, null, "Could not reach Ustaad. Check your connection and try again.");
    }
    throw error;
  } finally {
    timed.cleanup();
  }
}

function audioForm(audio: File, lang: SupportedLanguage = "hinglish"): FormData {
  const form = new FormData();
  form.append("audio", audio, audio.name);
  form.append("lang", lang);
  return form;
}

export const ustaadApi = {
  health(options?: { signal?: AbortSignal; timeoutMs?: number }) {
    return request<HealthResponse>("/health", { method: "GET" }, options);
  },

  diagnose(input: DiagnosisRequest, options?: { signal?: AbortSignal; timeoutMs?: number }) {
    const form = audioForm(input.audio, input.lang);
    if (input.image) form.append("image", input.image, input.image.name);
    return request<DiagnosisResponse>("/api/diagnose", { method: "POST", body: form }, options);
  },

  extractBill(input: BillRequest, options?: { signal?: AbortSignal; timeoutMs?: number }) {
    const form = audioForm(input.audio, input.lang);
    if (input.customer_name) form.append("customer_name", input.customer_name);
    return request<BillExtractionResponse>("/api/bill", { method: "POST", body: form }, options);
  },

  confirmBill(input: BillConfirmRequest, options?: { signal?: AbortSignal; timeoutMs?: number }) {
    return request<BillConfirmResponse>("/api/bill/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }, options);
  },

  async speak(input: TtsRequest, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<Blob> {
    const timed = createTimedSignal(options?.signal, options?.timeoutMs);
    try {
      const response = await fetch(`${apiBaseUrl()}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/*" },
        body: JSON.stringify({ text: input.text, lang: input.lang ?? "hinglish" }),
        signal: timed.signal,
      });
      if (!response.ok) {
        throw await parseApiError(response, `Speech generation failed (${response.status}).`);
      }
      return await response.blob();
    } catch (error) {
      if (error instanceof UstaadApiError) throw error;
      if (timed.signal.aborted) {
        const didTimeout = timed.signal.reason?.name === "TimeoutError";
        throw new UstaadApiError(
          didTimeout ? 408 : 0, null,
          didTimeout ? "Speech generation timed out. Please try again." : "The request was cancelled.",
        );
      }
      if (error instanceof TypeError) {
        throw new UstaadApiError(0, null, "Could not reach Ustaad. Check your connection and try again.");
      }
      throw error;
    } finally {
      timed.cleanup();
    }
  },
};
