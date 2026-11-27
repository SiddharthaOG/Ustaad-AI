import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/api/billing-demo.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { demoBillExtraction, demoConfirmBill } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

assert.equal(demoBillExtraction.items.length, 3);
assert.equal(demoBillExtraction.total_complete, false);
const incomplete = demoConfirmBill("Ramesh Kumar", demoBillExtraction.items);
assert.equal(incomplete.total_complete, false);
assert.equal(incomplete.total, null);
assert.equal(incomplete.whatsapp_text, null);
assert.equal(incomplete.items[1].line_total, null);

const completeItems = demoBillExtraction.items.map((item, index) => index === 1
  ? { ...item, unit_price: "25.00", needs_confirmation: false }
  : item);
const complete = demoConfirmBill("Ramesh Kumar", completeItems);
assert.equal(complete.total_complete, true);
assert.equal(complete.subtotal, "850.00");
assert.equal(complete.total, "850.00");
assert.match(complete.whatsapp_text, /No GST included/);
assert.match(complete.whatsapp_text, /Copper wire/);

const rounded = demoConfirmBill(null, [{
  name: "Test part", qty: "1.5", unit: "piece", unit_price: "10.01",
  kind: "part", needs_confirmation: false,
}]);
assert.equal(rounded.total, "15.02");

const unsafe = demoConfirmBill(null, [{
  name: "Huge part", qty: "999999999999999999", unit: "piece", unit_price: "999999999999999999",
  kind: "part", needs_confirmation: false,
}]);
assert.equal(unsafe.total_complete, false);
assert.equal(unsafe.total, null);

console.log("✔ missing prices keep totals and WhatsApp sharing disabled");
console.log("✔ confirmed demo items produce server-shaped line totals and a no-GST message");
console.log("✔ decimal quantity rounding and unsafe numeric overflow are handled");
