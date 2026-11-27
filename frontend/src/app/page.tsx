"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

const principles = [
  { number: "01", title: "Grounded answers", tag: "KB-GROUNDED", copy: "Fault codes are matched to curated, source-cited entries. If nothing matches, Ustaad says so instead of inventing a fix." },
  { number: "02", title: "Safety comes first", tag: "RULE-BASED", copy: "A deterministic safety alert is shown and spoken before any repair step. The model can add warnings, never remove them." },
  { number: "03", title: "Code does the maths", tag: "NOT THE LLM", copy: "The model extracts spoken line items. Quantities, prices and totals are calculated in code." },
  { number: "04", title: "You stay in charge", tag: "TECHNICIAN CONFIRMS", copy: "Review and edit every bill before sharing. Ustaad supports your judgement; it never replaces it." },
];

const steps = [
  { number: "01", verb: "SPEAK", title: "Describe the fault", copy: "Tell Ustaad what the machine is doing in Hindi or Hinglish. No need to type.", icon: "voice" },
  { number: "02", verb: "SHOW", title: "Snap the component", copy: "Show the PCB, error display or breaker with your phone camera.", icon: "camera" },
  { number: "03", verb: "HEAR", title: "Get spoken guidance", copy: "Hear concise repair checks, with the safety warning before the first step.", icon: "sound" },
  { number: "04", verb: "BILL", title: "Confirm and send", copy: "Speak parts and labour, review the itemised bill, then share it on WhatsApp.", icon: "bill" },
];

function Wordmark({ light = false }: { light?: boolean }) {
  return <Link className={`wordmark ${light ? "wordmark-light" : ""}`} href="/" aria-label="Ustaad AI home"><span className="wordmark-symbol">u.</span><span className="wordmark-name">ustaad<span>.ai</span></span></Link>;
}

function Arrow() {
  return <span className="arrow-icon" aria-hidden="true">â†—</span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -35px 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="landing-page" id="top">
      <header className="site-header">
        <div className="nav-wrap">
          <Wordmark />
          <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
            <a href="#how-it-works" onClick={closeMenu}>How it works</a>
            <a href="#why-ustaad" onClick={closeMenu}>Why Ustaad</a>
            <a href="#trust" onClick={closeMenu}>Trust & safety</a>
            <a className="nav-mobile-cta" href="/workspace" onClick={closeMenu}>Open workspace <Arrow /></a>
          </nav>
          <a className="nav-cta" href="/workspace">Open workspace <Arrow /></a>
          <button className={`menu-toggle ${menuOpen ? "menu-active" : ""}`} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><span/><span/></button>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-grid-texture" aria-hidden="true"/>
        <div className="hero-glow hero-glow-one" aria-hidden="true"/>
        <div className="hero-glow hero-glow-two" aria-hidden="true"/>
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow eyebrow-amber"><span className="eyebrow-line"/> BUILT FOR THE WORKSHOP FLOOR <span className="eyebrow-dot">Â·</span> MADE FOR BHARAT</div>
            <h1>Bolo.<br/><span>Dikhao.</span><br/>Theek karo<span className="hero-period">.</span></h1>
            <p className="hero-description">A hands-free voice and camera co-pilot for Indian mechanics and field technicians.</p>
            <div className="hero-actions">
              <a className="button button-amber" href="/workspace">Try Ustaad AI <Arrow /></a>
              <a className="button button-ghost" href="#how-it-works"><span className="play-icon">â–¶</span> See how it works</a>
            </div>
            <div className="hero-proof"><span className="proof-dot"/> Voice-first <i/> Hindi & Hinglish <i/> Safety before steps</div>
          </div>

          <div className="hero-visual" aria-label="Illustration of the Ustaad AI mobile interface">
            <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
            <div className="visual-note note-top"><span className="note-icon">â—‰</span><span><b>VOICE FIRST</b><small>Speak naturally</small></span></div>
            <div className="phone-frame">
              <div className="phone-island"/>
              <div className="phone-screen">
                <div className="phone-status"><span>9:41</span><span>â—â—â— â—–</span></div>
                <div className="phone-brand"><span className="mini-mark">u.</span><b>Ustaad AI</b><span className="phone-live"><i/> LIVE</span></div>
                <div className="phone-greeting"><small>GOOD MORNING, TECHNICIAN</small><strong>What are we<br/>fixing today?</strong></div>
                <div className="phone-warning"><span>!</span><div><b>Safety first</b><small>Switch off the main MCB first.</small></div></div>
                <div className="phone-result"><div className="phone-result-head"><span>NEXT STEPS</span><span>02</span></div><p><b>01</b> Check the communication wire</p><p><b>02</b> Inspect the outdoor PCB connector</p></div>
                <div className="phone-mic-wrap"><div className="phone-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="phone-mic">â—</div><small>Tap to speak</small></div>
                <div className="phone-bottom"><span>DIAGNOSE</span><span className="phone-bottom-active">BILL</span><span>HISTORY</span></div>
              </div>
            </div>
            <div className="visual-note note-bottom"><span className="note-icon note-green">âœ“</span><span><b>SAFETY CHECKED</b><small>Warning before repair steps</small></span></div>
            <div className="visual-caption">A BETTER WAY TO GET THE JOB DONE <span>âœ³</span></div>
          </div>
        </div>
        <div className="hero-bottomline"><span>USTAAD AI <b>Â·</b> THE WORKSHOP COPILOT</span><span>01 / BUILT AROUND YOUR WORKFLOW</span></div>
      </section>

      <section className="problem-section section-pad" id="why-ustaad">
        <div className="section-container">
          <div className="section-kicker" data-reveal><span>01</span> THE PROBLEM <i/></div>
          <div className="section-heading-row" data-reveal>
            <h2>Hands busy.<br/><em>Knowledge scattered.</em></h2>
            <p>Good technicians shouldn&apos;t have to stop the job to search, translate a manual or remember every line on a bill.</p>
          </div>
          <div className="problem-grid">
            <article className="problem-card" data-reveal><span className="number-disc">1</span><h3>Hands are occupied</h3><p>Greasy hands and active jobs make typing into a search engineâ€”or writing a bill by handâ€”slow and impractical.</p><span className="card-index">THE WORK</span></article>
            <article className="problem-card" data-reveal><span className="number-disc">2</span><h3>Knowledge is in English</h3><p>Technical manuals speak one language. Technicians work in Hindi, regional languages and code-mixed speech.</p><span className="card-index">THE LANGUAGE</span></article>
            <article className="problem-card" data-reveal><span className="number-disc">3</span><h3>Billing leaks revenue</h3><p>Parts and labour that aren&apos;t itemised while the job is fresh are easy to forgetâ€”and easy to lose.</p><span className="card-index">THE BUSINESS</span></article>
          </div>
          <div className="problem-punchline" data-reveal><span>âœ³</span> The answer should come to the technicianâ€”spoken, in their language, with hands free.</div>
        </div>
      </section>

      <section className="workflow-section section-pad" id="how-it-works">
        <div className="section-container">
          <div className="section-kicker section-kicker-light" data-reveal><span>02</span> ONE SIMPLE WORKFLOW <i/></div>
          <div className="section-heading-row section-heading-light" data-reveal>
            <h2>Speak. Show.<br/><em>Hear. Bill.</em></h2>
            <p>One thumb-friendly experience for the two jobs that matter: finding the fault and getting paid for the work.</p>
          </div>
          <div className="workflow-track">
            {steps.map((step, index) => <article className="workflow-card" data-reveal key={step.number}>
              <div className={`workflow-art art-${step.icon}`}>
                {step.icon === "voice" && <><div className="voice-bars">{Array.from({length:11},(_,i)=><i key={i}/>)}</div><span className="voice-pill"/></>}
                {step.icon === "camera" && <div className="camera-shape"><span/></div>}
                {step.icon === "sound" && <><span className="safety-stamp">SAFETY FIRST</span><div className="sound-bars">{Array.from({length:6},(_,i)=><i key={i}/>)}</div></>}
                {step.icon === "bill" && <div className="bill-illustration"><i/><i/><i/><b/><span>WHATSAPP</span></div>}
              </div>
              <div className="workflow-meta"><span>{step.number}</span> {step.verb}</div>
              <h3>{step.title}</h3><p>{step.copy}</p>
              {index < 3 && <span className="workflow-arrow">â†’</span>}
            </article>)}
          </div>
          <div className="workflow-footnote"><span className="green-pulse"/> Designed for real jobs, real phones and real workshop conditions.</div>
        </div>
      </section>

      <section className="two-flows-section section-pad">
        <div className="section-container">
          <div className="section-kicker" data-reveal><span>03</span> TWO GOLDEN PATHS <i/></div>
          <div className="section-heading-row" data-reveal>
            <h2>Less time stuck.<br/><em>More work accounted for.</em></h2>
            <p>Ustaad keeps the experience focused. No clutter, no sprawling toolsetâ€”just two flows that earn their place.</p>
          </div>
          <div className="flows-grid">
            <article className="flow-feature flow-diagnose" data-reveal>
              <div className="flow-feature-top"><span>01 / DIAGNOSE</span><span className="flow-feature-icon">âŒ</span></div>
              <h3>Find the fault.<br/><em>Not another guess.</em></h3>
              <p>Describe the symptom, show the component and get grounded checks with safety up front.</p>
              <ul><li><span>âœ“</span> Voice + optional camera input</li><li><span>âœ“</span> Verified, source-cited fault base</li><li><span>âœ“</span> Spoken steps, warning first</li></ul>
              <div className="diagnose-mini"><div className="mini-top"><span>USTAAD&apos;S FINDINGS</span><span className="mini-status">â— REVIEW</span></div><b>Possible communication fault</b><div className="mini-warning"><strong>!</strong> Isolate power before inspection.</div><div className="mini-step"><i>01</i> Check the communication wire</div><div className="mini-step"><i>02</i> Inspect the connector</div></div>
            </article>
            <article className="flow-feature flow-bill" data-reveal>
              <div className="flow-feature-top"><span>02 / BILL</span><span className="flow-feature-icon">â–¤</span></div>
              <h3>Capture the work.<br/><em>Keep every rupee.</em></h3>
              <p>Speak parts and labour, review the line items and share a clean bill with the customer.</p>
              <ul><li><span>âœ“</span> Voice-to-itemised bill</li><li><span>âœ“</span> Editable parts and labour</li><li><span>âœ“</span> One-tap WhatsApp handoff</li></ul>
              <div className="bill-mini"><div className="mini-top"><span>WORK SUMMARY</span><span className="mini-status">DRAFT</span></div><div className="bill-mini-line"><span>Capacitor 35ÂµF</span><b>â‚¹450</b></div><div className="bill-mini-line"><span>Inspection & fitting</span><b>â‚¹350</b></div><div className="bill-mini-total"><span>TOTAL DUE</span><b>â‚¹800</b></div><div className="bill-mini-share">â†— READY TO SHARE ON WHATSAPP</div></div>
            </article>
          </div>
          <p className="prototype-disclaimer">Interface previews are illustrative. Live diagnosis and billing are subject to backend integration and technician confirmation.</p>
        </div>
      </section>

      <section className="trust-section section-pad" id="trust">
        <div className="section-container">
          <div className="section-kicker section-kicker-light" data-reveal><span>04</span> TRUST & SAFETY <i/></div>
          <div className="section-heading-row section-heading-light" data-reveal>
            <h2>Model answers.<br/><em>System checks.</em><br/>You decide.</h2>
            <p>Repair advice and bills affect real equipment and real money. That&apos;s why Ustaad never treats raw model output as the final word.</p>
          </div>
          <div className="principles-grid">
            {principles.map((item) => <article className="principle-card" data-reveal key={item.number}><div className="principle-top"><span className="number-disc">{item.number.slice(1)}</span><span>{item.tag}</span></div><h3>{item.title}</h3><p>{item.copy}</p></article>)}
          </div>
        </div>
      </section>

      <section className="closing-section">
        <div className="closing-texture" aria-hidden="true"/>
        <div className="closing-inner" data-reveal>
          <div className="section-kicker section-kicker-light"><span>05</span> BUILT FOR BHARAT <i/></div>
          <h2>Keep your hands<br/>on the work.</h2>
          <p>Let Ustaad handle the searching, the steps and the billâ€”so you can focus on the fix.</p>
          <a className="button button-amber" href="/workspace">Get started with Ustaad <Arrow /></a>
          <div className="closing-signoff">Bolo. Dikhao. Theek karo. <span>âœ³</span></div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-main"><Wordmark light/><p>A voice-first workshop co-pilot<br/>for the people who keep India running.</p><a href="/workspace">Open workspace <Arrow /></a></div>
        <div className="footer-bottom"><span>Â© 2026 Ustaad AI</span><span>BUILT FOR BHARAT <b>Â·</b> SPEAK. SHOW. FIX.</span><a href="#top" onClick={(e)=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"});}}>Back to top â†‘</a></div>
      </footer>
    </main>
  );
}
