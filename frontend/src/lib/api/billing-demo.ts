import type { BillConfirmResponse, BillExtractionResponse, BillItem } from "./contracts";

export const demoBillExtraction: BillExtractionResponse = {
  transcript: "Ramesh Kumar. Replaced one 35 microfarad capacitor, used two metres of copper wire, and charged for inspection and fitting.",
  customer: "Ramesh Kumar",
  items: [
    { name: "Capacitor 35µF", qty: "1", unit: "piece", unit_price: "450.00", kind: "part", needs_confirmation: false },
    { name: "Copper wire", qty: "2", unit: "metre", unit_price: null, kind: "part", needs_confirmation: true },
    { name: "Inspection & fitting", qty: "1", unit: "job", unit_price: "350.00", kind: "labour", needs_confirmation: false },
  ],
  unsupported_mentions: ["Warranty discussion mentioned; not included as a billable item."],
  total: null,
  total_complete: false,
  whatsapp_text: null,
  provider: "demo-fixture",
  latency_ms: 360,
};

function decimalToScaled(value: string, scale: number): number | null {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > scale) return null;
  const result = Number(match[1]) * (10 ** scale) + Number((match[2] ?? "").padEnd(scale, "0") || "0");
  return Number.isSafeInteger(result) ? result : null;
}

function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatRupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Explicit demo-only stand-in for the backend confirmation response. */
export function demoConfirmBill(customer: string | null, items: BillItem[]): BillConfirmResponse {
  let subtotal = 0;
  let totalComplete = items.length > 0;
  const confirmedItems = items.map((item) => {
    if (item.needs_confirmation || item.unit_price === null) {
      totalComplete = false;
      return { ...item, line_total: null };
    }
    const qtyMilli = decimalToScaled(item.qty, 3);
    const priceCents = decimalToScaled(item.unit_price, 2);
    if (qtyMilli === null || priceCents === null) {
      totalComplete = false;
      return { ...item, line_total: null };
    }
    // qty is in thousandths and price is in cents; round the product to cents.
    const rawLine = qtyMilli * priceCents;
    if (!Number.isSafeInteger(rawLine)) {
      totalComplete = false;
      return { ...item, line_total: null };
    }
    const lineCents = Math.floor((rawLine + 500) / 1000);
    subtotal += lineCents;
    return { ...item, line_total: centsToString(lineCents) };
  });
  if (!Number.isSafeInteger(subtotal)) totalComplete = false;
  const subtotalText = totalComplete ? centsToString(subtotal) : null;
  const whatsappText = totalComplete
    ? [
        "Ustaad AI · Service bill",
        customer?.trim() ? `Customer: ${customer.trim()}` : null,
        ...confirmedItems.map((item) => `• ${item.name} — ${item.qty} ${item.unit} × ₹${item.unit_price} = ₹${item.line_total}`),
        `Total: ${formatRupees(subtotal)}`,
        "(No GST included)",
      ].filter(Boolean).join("\\n")
    : null;

  return {
    items: confirmedItems,
    subtotal: subtotalText,
    total: subtotalText,
    total_complete: totalComplete,
    whatsapp_text: whatsappText,
  };
}
