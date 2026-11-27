/* eslint react/no-unescaped-entities: off */
"use client";

import Link from "next/link";

export default function SignUpPage() {
  return <main className="signup-page">
    <header><Link href="/" className="wordmark"><span className="wordmark-symbol">u.</span><span className="wordmark-name">ustaad<span>.ai</span></span></Link><Link href="/">Back to home ←</Link></header>
    <section className="signup-card">
      <span className="signup-kicker">GOOD TO HAVE YOU HERE</span>
      <div className="signup-mark">u.</div>
      <h1>Your workday<br/><em>could use a Ustaad.</em></h1>
      <p>We're getting account sign-up ready. The live account and verification flow isn't connected yet, so we're not going to pretend this form works.</p>
      <div className="signup-note"><span>✳</span><div><b>You're early. That's a good thing.</b><small>Explore the current workspace preview while we finish the sign-up experience.</small></div></div>
      <Link className="button button-amber" href="/workspace">Explore the workspace <span>↗</span></Link>
      <Link className="signup-back" href="/">Take another look around</Link>
    </section>
    <footer>© 2026 Ustaad AI · Built for the workshop floor</footer>
  </main>;
}
