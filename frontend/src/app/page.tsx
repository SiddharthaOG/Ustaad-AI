/* eslint react/no-unescaped-entities: off */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RecognitionResult = { [index: number]: { transcript: string } };
type RecognitionEvent = { results: RecognitionResult[] };
type Recognition = {
  lang: string; interimResults: boolean; onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void;
};

const steps = [
  { n: "01", title: "Tell Ustaad", copy: "Say what the machine is doing. No forms, no technical wording needed.", cue: "“The AC is running, but the room isn't cooling.”", icon: "◖" },
  { n: "02", title: "Show what you see", copy: "Add a photo of the display, component or wiring when it helps.", cue: "A photo gives Ustaad more context.", icon: "▧" },
  { n: "03", title: "Work through it", copy: "Hear clear checks in Hindi or Hinglish, with safety guidance first.", cue: "Safety warning → checks → your decision.", icon: "≋" },
  { n: "04", title: "Make the bill", copy: "Speak parts and labour. Check every item, then share the bill.", cue: "You review it before it goes anywhere.", icon: "₹" },
];

function Mark() {
  return <Link href="/" className="wordmark" aria-label="Ustaad AI home"><span className="wordmark-symbol">u.</span><span className="wordmark-name">ustaad<span>.ai</span></span></Link>;
}

export default function Home() {
  const router = useRouter();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState([{ from: "ustaad", text: "Namaste! I'm here. Ask me to show you around, diagnose a fault, or make a bill." }]);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) { nodes.forEach(n => n.classList.add("is-visible")); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); observer.unobserve(e.target); }
    }), { threshold: 0.12 });
    nodes.forEach(n => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => recognition.current?.stop(), []);

  const runCommand = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setMessages(m => [...m, { from: "you", text: value }]);
    setCommand("");
    const q = value.toLowerCase();
    if (/(workflow|how.*work|show.*(me )?(how|workflow)|guide|walkthrough)/.test(q)) {
      setMessages(m => [...m, { from: "ustaad", text: "Of course. I'll walk you through it, one step at a time." }]);
      setGuideStep(0); setGuideOpen(true); return;
    }
    if (/(sign me up|sign up|register|create account|join)/.test(q)) {
      setMessages(m => [...m, { from: "ustaad", text: "Let's get you started. Opening the sign-up page." }]);
      router.push("/signup"); return;
    }
    if (/(bill|invoice|payment)/.test(q)) {
      setMessages(m => [...m, { from: "ustaad", text: "Let's put the work into a bill. You can review every item before sharing." }]);
      router.push("/workspace?mode=bill"); return;
    }
    if (/(diagnos|fault|repair|problem|not working)/.test(q)) {
      setMessages(m => [...m, { from: "ustaad", text: "Let's look at the problem together. Tell me what the machine is doing." }]);
      router.push("/workspace"); return;
    }
    setMessages(m => [...m, { from: "ustaad", text: "I can show the workflow, open diagnosis, or help make a bill. Try saying one of those." }]);
  };

  const startListening = () => {
    const Speech = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition });
    const Engine = Speech.SpeechRecognition || Speech.webkitSpeechRecognition;
    if (!Engine) {
      setMessages(m => [...m, { from: "ustaad", text: "Voice input isn't supported in this browser yet. You can type to me here." }]);
      return;
    }
    const rec = new Engine();
    recognition.current = rec; rec.lang = "hi-IN"; rec.interimResults = false;
    rec.onresult = event => runCommand(event.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true); rec.start();
  };

  const movePhone = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const r = event.currentTarget.getBoundingClientRect();
    setTilt({ x: ((event.clientY - r.top) / r.height - .5) * -9, y: ((event.clientX - r.left) / r.width - .5) * 10 });
  };

  return (
    <main className="landing-page" id="top">
      <header className="site-header"><div className="nav-wrap">
        <Mark />
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#overview">Overview</a>
          <button className="nav-guide" onClick={() => { setGuideStep(0); setGuideOpen(true); }}>How it works <span>↗</span></button>
          <a href="#why-ustaad">Why Ustaad</a><a href="#trust">Trust & safety</a>
        </nav>
        <Link className="nav-cta" href="/workspace">Try Ustaad <span>↗</span></Link>
      </div></header>

      <section className="hero-section" id="overview">
        <div className="hero-grid-texture" aria-hidden="true" /><div className="hero-glow hero-glow-one" aria-hidden="true" /><div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow eyebrow-amber"><span className="eyebrow-line" /> YOUR WORKSHOP, WITH A VOICE <span className="eyebrow-dot">✳</span></div>
            <h1>Kaam bolo.<br /><span>Ustaad</span> sambhale.</h1>
            <p className="hero-description">A helpful voice companion for mechanics and field technicians. Talk through a fault, show what you see, and get a clearer next step.</p>
            <div className="hero-actions"><Link className="button button-amber" href="/workspace">Come on in <span>↗</span></Link><button className="button button-ghost" onClick={() => { setGuideStep(0); setGuideOpen(true); }}><span className="play-icon">▶</span> Take a quick tour</button></div>
            <div className="hero-proof"><span className="proof-dot" /> Speak naturally <i /> Hindi & Hinglish <i /> You stay in control</div>
          </div>
          <div className="hero-visual" onPointerMove={movePhone} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
            <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
            <div className="visual-note note-top"><span className="note-icon">♫</span><span><b>JUST TALK</b><small>No typing needed</small></span></div>
            <div className="phone-frame" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotate(3deg)` }}>
              <div className="phone-island" /><div className="phone-screen">
                <div className="phone-status"><span>9:41</span><span>● ● ● ▰</span></div>
                <div className="phone-brand"><span className="mini-mark">u.</span><b>Ustaad AI</b><span className="phone-live"><i /> HERE WITH YOU</span></div>
                <div className="phone-greeting"><small>CHALO, SHURU KARTE HAIN</small><strong>What's going<br />on today?</strong></div>
                <div className="phone-chat"><span className="chat-avatar">u.</span><p>Tell me what the machine is doing.</p></div>
                <div className="phone-user">The AC is running, but not cooling.</div>
                <div className="phone-warning"><span>!</span><div><b>First, stay safe</b><small>Switch off power before opening the unit.</small></div></div>
                <div className="phone-mic-wrap"><div className="phone-wave">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</div><div className="phone-mic">●</div><small>Tap and tell me</small></div>
                <div className="phone-bottom"><span>ASK</span><span className="phone-bottom-active">LISTEN</span><span>YOUR BILLS</span></div>
              </div>
            </div>
            <div className="visual-note note-bottom"><span className="note-icon note-green">✓</span><span><b>YOUR CALL, ALWAYS</b><small>Review before you act</small></span></div>
            <div className="visual-caption">MADE FOR THE WORKSHOP FLOOR <span>✳</span></div>
          </div>
        </div>
        <div className="hero-bottomline"><span>USTAAD AI <b>·</b> YOUR WORKSHOP COMPANION</span><span>BUILT AROUND THE WAY YOU WORK</span></div>
      </section>

      <section className="problem-section section-pad" id="why-ustaad"><div className="section-container">
        <div className="section-kicker" data-reveal><span>01</span> WHY WE'RE HERE <i /></div>
        <div className="section-heading-row" data-reveal><h2>Good work deserves<br /><em>good support.</em></h2><p>When your hands are busy and the job can't wait, help should be easy to reach. Not buried in a manual or another app.</p></div>
        <div className="problem-grid">
          <article className="problem-card" data-reveal><span className="number-disc">1</span><h3>Keep your hands on the job</h3><p>Talk instead of typing. Get help while you're right there with the machine.</p><span className="card-index">LESS STOPPING</span></article>
          <article className="problem-card" data-reveal><span className="number-disc">2</span><h3>Speak like you normally do</h3><p>Explain the issue in Hindi or Hinglish. You don't need to know the perfect technical term.</p><span className="card-index">LESS TRANSLATING</span></article>
          <article className="problem-card" data-reveal><span className="number-disc">3</span><h3>Remember every part</h3><p>Capture parts and labour while the work is fresh. Check the bill before you share it.</p><span className="card-index">LESS FORGOTTEN</span></article>
        </div>
        <div className="problem-punchline" data-reveal><span>✳</span> You do the skilled work. Ustaad helps with the remembering, checking and explaining.</div>
      </div></section>

      <section className="workflow-section section-pad" id="how-it-works"><div className="section-container">
        <div className="section-kicker section-kicker-light" data-reveal><span>02</span> FOUR EASY MOVES <i /></div>
        <div className="section-heading-row section-heading-light" data-reveal><h2>From “what's wrong?”<br /><em>to “job done”.</em></h2><p>No complicated setup. Just a simple conversation that follows the work you already do.</p></div>
        <div className="workflow-track">{steps.map((step, i) => <article className="workflow-card" data-reveal key={step.n}>
          <div className={`workflow-art art-${i}`}><span className="workflow-icon">{step.icon}</span><span className="workflow-orbit" /></div>
          <div className="workflow-meta"><span>{step.n}</span> {["TELL","SHOW","CHECK","BILL"][i]}</div><h3>{step.title}</h3><p>{step.copy}</p><small className="workflow-cue">{step.cue}</small>
        </article>)}</div>
        <div className="workflow-footnote"><span className="green-pulse" /> Start with a voice note. Add a photo only when it helps.</div>
      </div></section>

      <section className="roleplay-invite-section">
        <div className="roleplay-invite-inner" data-reveal>
          <div className="roleplay-invite-copy">
            <div className="section-kicker"><span>03</span> YOUR TURN AT THE WORKSHOP <i /></div>
            <h2>Want to see it<br /><em>in action?</em></h2>
            <p>Choose one of three workshop stories. Step into each person's shoes, record the problem, review a grounded diagnosis, and follow the customer handoff through a clearly labelled sample bill.</p>
            <div className="roleplay-invite-points"><span>01 · Meet the customer</span><span>02 · Diagnose safely</span><span>03 · Review the bill</span></div>
            <Link className="button button-amber" href="/workspace?roleplay=workshop">Start the prepared roleplay <span>→</span></Link>
            <small>Guided demo · Sample customer and billing data clearly marked</small>
          </div>
          <div className="roleplay-invite-visual" aria-label="Illustration of a mechanic's workshop roleplay">
            <div className="roleplay-blueprint-grid" />
            <div className="roleplay-visual-label">TODAY'S CUSTOMER <span>DEMO 01</span></div>
            <div className="roleplay-customer-card"><div className="roleplay-customer-avatar">RK</div><div><strong>Ramesh Kumar</strong><small>AC service visit · Customer</small></div><span className="roleplay-status-dot" /></div>
            <div className="roleplay-speech-card"><small>WHAT HE SAYS</small><p>“The AC starts, but the outdoor fan isn't running. There's a burning smell.”</p></div>
            <div className="roleplay-visual-footer"><span>LISTEN</span><i /><i /><i /><i /><i /><span>CHECK</span><b>→</b><span>BILL</span></div>
          </div>
        </div>
      </section>

      <section className="two-flows-section section-pad"><div className="section-container">
        <div className="section-kicker" data-reveal><span>04</span> TWO THINGS, DONE BETTER <i /></div>
        <div className="section-heading-row" data-reveal><h2>Help with the fix.<br /><em>Help with the bill.</em></h2><p>Ustaad keeps the focus on the two moments where a little support can make the working day easier.</p></div>
        <div className="flows-grid">
          <article className="flow-feature flow-diagnose" data-reveal><div className="flow-feature-top"><span>01 / FIND THE FAULT</span><span className="flow-feature-icon">⌁</span></div><h3>Let's figure it out.<br /><em>One check at a time.</em></h3><p>Describe the symptom, show the component and work through grounded checks with safety up front.</p><ul><li><span>✓</span> Talk it through, add a photo if useful</li><li><span>✓</span> Clear checks based on verified information</li><li><span>✓</span> Safety warning before repair steps</li></ul><div className="diagnose-mini"><div className="mini-top"><span>WHAT WE'VE FOUND</span><span className="mini-status">NEEDS YOUR CHECK</span></div><b>Possible capacitor issue</b><div className="mini-warning"><strong>!</strong> Isolate power before inspection.</div><div className="mini-step"><i>01</i> Check the capacitor rating</div><div className="mini-step"><i>02</i> Inspect for visible damage</div></div></article>
          <article className="flow-feature flow-bill" data-reveal><div className="flow-feature-top"><span>02 / MAKE THE BILL</span><span className="flow-feature-icon">₹</span></div><h3>Get the work<br /><em>down on paper.</em></h3><p>Say what you used and what the work cost. Review the items before sharing with your customer.</p><ul><li><span>✓</span> Speak parts and labour</li><li><span>✓</span> Edit every line item</li><li><span>✓</span> Share when you're ready</li></ul><div className="bill-mini"><div className="mini-top"><span>YOUR WORK SUMMARY</span><span className="mini-status">DRAFT</span></div><div className="bill-mini-line"><span>Capacitor 35µF</span><b>₹450</b></div><div className="bill-mini-line"><span>Inspection & fitting</span><b>₹350</b></div><div className="bill-mini-total"><span>TOTAL DUE</span><b>₹800</b></div><div className="bill-mini-share">CHECK IT. THEN SHARE IT.</div></div></article>
        </div>
        <p className="prototype-disclaimer">The prepared roleplay uses clearly labelled sample data. Live diagnosis and TTS use the connected service; billing demo confirmation is simulated until the billing backend is integrated.</p>
      </div></section>

      <section className="trust-section section-pad" id="trust"><div className="section-container">
        <div className="section-kicker section-kicker-light" data-reveal><span>05</span> BUILT TO BE CAREFUL <i /></div>
        <div className="section-heading-row section-heading-light" data-reveal><h2>Helpful, not<br /><em>overconfident.</em></h2><p>Machines, safety and money matter. Ustaad should be clear about what it knows—and just as clear when you need to check something.</p></div>
        <div className="principles-grid">
          <article className="principle-card" data-reveal><div className="principle-top"><span className="number-disc">01</span><span>VERIFIED INFORMATION</span></div><h3>No made-up answers</h3><p>When a fault isn't covered by verified information, Ustaad should say so instead of guessing.</p></article>
          <article className="principle-card" data-reveal><div className="principle-top"><span className="number-disc">02</span><span>SAFETY FIRST</span></div><h3>Warnings come early</h3><p>Important safety guidance appears before repair steps—not buried at the end.</p></article>
          <article className="principle-card" data-reveal><div className="principle-top"><span className="number-disc">03</span><span>REAL CALCULATIONS</span></div><h3>Numbers are checked</h3><p>Bill totals are calculated by the system, not guessed by a language model.</p></article>
          <article className="principle-card" data-reveal><div className="principle-top"><span className="number-disc">04</span><span>YOUR DECISION</span></div><h3>You approve the action</h3><p>You review the diagnosis and every bill item. Ustaad supports your judgement; it doesn't replace it.</p></article>
        </div>
      </div></section>

      <section className="closing-section"><div className="closing-texture" /><div className="closing-inner" data-reveal>
        <div className="section-kicker section-kicker-light"><span>06</span> READY WHEN YOU ARE <i /></div>
        <h2>Chalo, kaam<br />shuru karein?</h2><p>Tell Ustaad what's happening. We'll take it one step at a time.</p>
        <div className="hero-actions"><Link className="button button-amber" href="/workspace">Open Ustaad <span>↗</span></Link><button className="button button-ghost" onClick={() => { setGuideStep(0); setGuideOpen(true); }}>Show me around</button></div>
        <div className="closing-signoff">Bolo. Dikhao. Samajho. Theek karo. <span>✳</span></div>
      </div></section>
      <footer className="site-footer"><div className="footer-main"><Mark /><p>A little more help for the people<br />who keep things running.</p><Link href="/workspace">Open workspace ↗</Link></div><div className="footer-bottom"><span>© 2026 Ustaad AI</span><span>MADE FOR THE WORKSHOP FLOOR</span><a href="#top">Back to top ↑</a></div></footer>

      <button className={`voice-launcher ${terminalOpen ? "is-open" : ""}`} onClick={() => setTerminalOpen(v => !v)} aria-label={terminalOpen ? "Close Ustaad voice assistant" : "Talk to Ustaad"}><span className="launcher-wave"><i/><i/><i/><i/></span><span>{terminalOpen ? "Close" : "Talk to Ustaad"}</span><b>{terminalOpen ? "×" : "↗"}</b></button>
      {terminalOpen && <aside className="voice-terminal" aria-label="Talk to Ustaad">
        <div className="terminal-head"><div><span className="terminal-live"><i/> HERE WITH YOU</span><h3>Bol, kya karna hai?</h3><p>Ask me in your own words.</p></div><button onClick={() => setTerminalOpen(false)} aria-label="Close">×</button></div>
        <div className="terminal-messages" aria-live="polite">{messages.map((m, i) => <div className={`terminal-message ${m.from}`} key={i}><span>{m.from === "you" ? "YOU" : "USTAAD"}</span><p>{m.text}</p></div>)}</div>
        <div className="terminal-suggestions"><button onClick={() => runCommand("Show me the workflow")}>Show me the workflow</button><button onClick={() => runCommand("Create a bill")}>Create a bill</button></div>
        <form className="terminal-input" onSubmit={e => { e.preventDefault(); runCommand(command); }}><input value={command} onChange={e => setCommand(e.target.value)} placeholder="Type what you need..." aria-label="Say or type a command" /><button type="button" className={listening ? "listening" : ""} onClick={startListening} aria-label="Speak to Ustaad"> {listening ? "●" : "♫"} </button><button type="submit" aria-label="Send message">↑</button></form>
        <small className="terminal-footnote">Try “show me the workflow” or “sign me up”. Voice input depends on browser support.</small>
      </aside>}

      {guideOpen && <div className="guide-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setGuideOpen(false); }}>
        <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <div className="guide-top"><span>YOUR FIRST FEW MINUTES WITH USTAAD</span><button onClick={() => setGuideOpen(false)} aria-label="Close guide">×</button></div>
          <div className="guide-progress">{steps.map((s, i) => <span key={s.n} className={i <= guideStep ? "active" : ""} />)}</div>
          <div className="guide-body"><div className="guide-step-icon">{steps[guideStep].icon}</div><small>STEP {steps[guideStep].n} OF 04</small><h2 id="guide-title">{steps[guideStep].title}</h2><p>{steps[guideStep].copy}</p><blockquote>{steps[guideStep].cue}</blockquote></div>
          <div className="guide-footer"><button className="guide-skip" onClick={() => setGuideOpen(false)}>I'll explore myself</button><div>{guideStep > 0 && <button className="guide-back" onClick={() => setGuideStep(s => s - 1)}>Back</button>}<button className="guide-next" onClick={() => guideStep < 3 ? setGuideStep(s => s + 1) : (setGuideOpen(false), router.push("/workspace"))}>{guideStep === 3 ? "Try Ustaad" : "Next step"} <span>→</span></button></div></div>
        </section>
      </div>}
    </main>
  );
}
