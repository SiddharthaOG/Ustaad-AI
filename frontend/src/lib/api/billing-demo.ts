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

/** Story-specific sample repair items for the A Day at the Workshop roleplay. */
export const demoWorkshopBillExtraction: BillExtractionResponse = {
  transcript: "Ramesh Kumar. Replaced one outdoor fan motor, used one fan motor connector, and charged for electrical inspection and fitting.",
  customer: "Ramesh Kumar",
  items: [
    { name: "Outdoor fan motor", qty: "1", unit: "piece", unit_price: "1850.00", kind: "part", needs_confirmation: false },
    { name: "Fan motor connector", qty: "1", unit: "piece", unit_price: "180.00", kind: "part", needs_confirmation: false },
    { name: "Electrical inspection & fitting", qty: "1", unit: "job", unit_price: "650.00", kind: "labour", needs_confirmation: false },
  ],
  unsupported_mentions: ["Warranty eligibility was not checked; confirm it with the customer before making any promise."],
  total: null,
  total_complete: false,
  whatsapp_text: null,
  provider: "demo-fixture",
  latency_ms: 0,
};


/** Scenario-specific illustrative billing fixtures; not real repair records. */
export const demoAmitBillExtraction: BillExtractionResponse = {
 transcript:"Amit Verma. Qualified technician safety inspection and professional diagnostic visit. No DIY repair was performed.",customer:"Amit Verma",
 items:[{name:"Qualified technician safety inspection",qty:"1",unit:"job",unit_price:"450.00",kind:"labour",needs_confirmation:false},{name:"Professional diagnostic visit",qty:"1",unit:"job",unit_price:"350.00",kind:"labour",needs_confirmation:false}],
 unsupported_mentions:["No DIY repair or safety-device bypass was performed."],total:null,total_complete:false,whatsapp_text:null,provider:"demo-fixture",latency_ms:0
};
export const demoImranBillExtraction: BillExtractionResponse = {
 transcript:"Farah Khan. Commercial refrigerator service visit with illustrative gasket, temperature sensor and inspection labour.",customer:"Farah Khan",
 items:[{name:"Refrigerator door gasket",qty:"1",unit:"piece",unit_price:"1250.00",kind:"part",needs_confirmation:false},{name:"Temperature sensor",qty:"1",unit:"piece",unit_price:"850.00",kind:"part",needs_confirmation:false},{name:"Cooling-system inspection",qty:"1",unit:"job",unit_price:"500.00",kind:"labour",needs_confirmation:false}],
 unsupported_mentions:["Sample items are not a diagnosis or a claim that these parts are faulty."],total:null,total_complete:false,whatsapp_text:null,provider:"demo-fixture",latency_ms:0
};
