export type SupportedLanguage = "hi" | "hinglish" | "en";

export interface HealthResponse {
  status: string;
  [key: string]: unknown;
}

export type ApiErrorCode =
  | "INVALID_REQUEST" | "FILE_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE"
  | "AUDIO_INVALID" | "IMAGE_INVALID" | "RATE_LIMITED"
  | "MODEL_ERROR" | "MODEL_TIMEOUT" | "INTERNAL_ERROR";

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode | string;
    message: string;
    request_id: string;
    details: unknown | null;
  };
}

export interface DiagnosisRequest {
  audio: File;
  image?: File | null;
  lang?: SupportedLanguage;
}

export interface DiagnosisResponse {
  transcript: string;
  detected_code: string | null;
  kb_id: string | null;
  grounded: boolean;
  needs_confirmation: boolean;
  confirm_question: string | null;
  error_meaning: string | null;
  probable_causes: string[];
  safety_alert: string;
  steps: string[];
  spoken_summary: string;
  /** Source-pack-compatible source title; not a URL or object. */
  source: string | null;
  photo_note: string | null;
  provider: string;
  latency_ms: number;
}

export interface BillRequest {
  audio: File;
  lang?: SupportedLanguage;
  customer_name?: string | null;
}

export type BillItemKind = "part" | "labour";

export interface BillItemDraft {
  name: string;
  /** Positive decimal string; maximum three decimal places. */
  qty: string;
  unit: string;
  /** Decimal string with two places, or null until confirmed. */
  unit_price: string | null;
  kind: BillItemKind;
}

export interface BillItem extends BillItemDraft {
  needs_confirmation: boolean;
}

export interface BillExtractionResponse {
  transcript: string;
  customer: string | null;
  items: BillItem[];
  unsupported_mentions: string[];
  total: string | null;
  total_complete: boolean;
  whatsapp_text: string | null;
  provider: string;
  latency_ms: number;
}

export interface BillConfirmRequest {
  customer: string | null;
  items: BillItemDraft[];
  unsupported_mentions: string[];
}

export interface ConfirmedBillItem extends BillItem {
  line_total: string | null;
}

export interface BillConfirmResponse {
  items: ConfirmedBillItem[];
  subtotal: string | null;
  total: string | null;
  total_complete: boolean;
  whatsapp_text: string | null;
}

export interface TtsRequest {
  text: string;
  lang?: SupportedLanguage;
}
