import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { File } from "node:buffer";
import ts from "typescript";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://ustaad.test";
const source = await readFile(new URL("../src/lib/api/client.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { ustaadApi, UstaadApiError } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const originalFetch = globalThis.fetch;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const audio = new File([Uint8Array.from([1, 2, 3])], "sample.wav", { type: "audio/wav" });
const image = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xff, 0xd9])], "unit.jpg", { type: "image/jpeg" });

try {
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return json({ status: "ok" });
  };
  await ustaadApi.health();
  assert.equal(captured.url, "http://ustaad.test/health");
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.headers.Accept, "application/json");

  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return json({ transcript: "fan noise", detected_code: "FAN-1" });
  };
  await ustaadApi.diagnose({ audio, image, lang: "hi" });
  assert.equal(captured.url, "http://ustaad.test/api/diagnose");
  assert.ok(captured.init.body instanceof FormData);
  assert.equal(captured.init.body.get("lang"), "hi");
  assert.equal(captured.init.body.get("audio").name, "sample.wav");
  assert.equal(captured.init.body.get("image").name, "unit.jpg");
  assert.equal(captured.init.headers["Content-Type"], undefined, "browser must set multipart boundary");

  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return json({ items: [], unsupported_mentions: [] });
  };
  await ustaadApi.extractBill({ audio, lang: "en", customer_name: "Ramesh" });
  assert.equal(captured.url, "http://ustaad.test/api/bill");
  assert.equal(captured.init.body.get("customer_name"), "Ramesh");
  assert.equal(captured.init.body.get("lang"), "en");

  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return json({ items: [], subtotal: "0.00", total: "0.00", total_complete: true, whatsapp_text: "Bill" });
  };
  await ustaadApi.confirmBill({ customer: "Ramesh", items: [], unsupported_mentions: [] });
  assert.equal(captured.url, "http://ustaad.test/api/bill/confirm");
  assert.equal(captured.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(captured.init.body), { customer: "Ramesh", items: [], unsupported_mentions: [] });

  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return new Response(Uint8Array.from([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/wav" } });
  };
  const spoken = await ustaadApi.speak({ text: "Switch off the power", lang: "hi" });
  assert.equal(captured.url, "http://ustaad.test/api/tts");
  assert.equal(captured.init.headers.Accept, "audio/*");
  assert.equal(spoken.size, 3);
  assert.deepEqual(JSON.parse(captured.init.body), { text: "Switch off the power", lang: "hi" });

  globalThis.fetch = async () => json({ error: { code: "INVALID_AUDIO", message: "Bad WAV", request_id: "req-42", details: { codec: "mp3" } } }, 422);
  await assert.rejects(
    ustaadApi.health(),
    (error) => error instanceof UstaadApiError && error.status === 422 &&
      error.code === "INVALID_AUDIO" && error.message === "Bad WAV" &&
      error.requestId === "req-42" && error.details.codec === "mp3",
  );

  globalThis.fetch = async () => new Response("upstream exploded", { status: 502 });
  await assert.rejects(ustaadApi.health(), (error) =>
    error instanceof UstaadApiError && error.status === 502 && error.code === "UNKNOWN_ERROR");

  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(ustaadApi.health(), (error) =>
    error instanceof UstaadApiError && error.status === 0 && error.message.includes("connection"));

  const waitForAbort = (_url, init = {}) => new Promise((resolve, reject) => {
    const signal = init.signal;
    const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
  globalThis.fetch = waitForAbort;
  await assert.rejects(ustaadApi.health({ timeoutMs: 8 }), (error) =>
    error instanceof UstaadApiError && error.status === 408 && error.message.includes("too long"));

  const parent = new AbortController();
  const cancelledRequest = ustaadApi.health({ signal: parent.signal, timeoutMs: 5_000 });
  setTimeout(() => parent.abort(), 8);
  await assert.rejects(cancelledRequest, (error) =>
    error instanceof UstaadApiError && error.status === 0 && error.message.includes("cancelled"));

  const ttsParent = new AbortController();
  const cancelledSpeech = ustaadApi.speak({ text: "test" }, { signal: ttsParent.signal, timeoutMs: 5_000 });
  setTimeout(() => ttsParent.abort(), 8);
  await assert.rejects(cancelledSpeech, (error) =>
    error instanceof UstaadApiError && error.status === 0 && error.message.includes("cancelled"));

  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  await assert.rejects(ustaadApi.health(), SyntaxError);

  console.log("✔ health, diagnosis, bill extraction, bill confirmation and TTS request contracts");
  console.log("✔ multipart boundaries, form fields, JSON payloads and audio Blob response");
  console.log("✔ structured API errors, non-JSON errors and network failures");
  console.log("✔ request timeout, caller cancellation and TTS cancellation distinction");
  console.log("✔ malformed success JSON is surfaced instead of silently accepted");
} finally {
  globalThis.fetch = originalFetch;
}
