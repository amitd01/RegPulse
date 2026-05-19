/**
 * Landing page — v2 terminal-modern (S8a).
 *
 * Editorial print + Bloomberg-terminal idiom. Replaces the pre-rebuild navy/
 * blue hero with a paper-on-paper layout: thin sticky TopBar with brand mark,
 * editorial hero (serif headline + amber dek + paired CTAs), three feature
 * panels with mono "01/02/03" tracks, and a mono ticker footer.
 *
 * No `bg-navy-*` / `text-navy-*` / `slate-*` / `bg-blue-*` / `bg-gray-*`.
 */

import Link from "next/link";

const features = [
  {
    code: "01",
    head: "Zero hallucination",
    tag: "RAG · CITATION-LOCKED",
    copy:
      "Every claim cites the circular number and verbatim quote it came from. If the corpus doesn't support an answer, we route you to the consult-expert fallback instead of guessing.",
  },
  {
    code: "02",
    head: "Daily synchronisation",
    tag: "CELERY · RBI.ORG.IN",
    copy:
      "Specialised workers index the RBI corpus every day. Supersession is tracked automatically so you only see the active law — never an outdated direction.",
  },
  {
    code: "03",
    head: "Action items mapped",
    tag: "TEAM · PRIORITY · DUE",
    copy:
      "Interpretations turn into team-tagged action items with priority and due dates. Treasury, Risk, Compliance, Legal — each team sees only their own assignments.",
  },
];

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* TopBar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "14px 32px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10 }}
          aria-label="RegPulse home"
          data-testid="landing-brand"
        >
          <span
            className="mono"
            style={{
              width: 28,
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--ink)",
              color: "var(--bg)",
              borderRadius: 2,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            RP
          </span>
          <span
            className="serif"
            style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            RegPulse
          </span>
        </Link>
        <span style={{ flex: 1 }} />
        <div className="tick" aria-hidden="true">
          REGULATORY INTELLIGENCE TERMINAL · INDIA
        </div>
        <span style={{ flex: 1 }} />
        <Link
          href="/login"
          className="mono up"
          data-testid="landing-signin"
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            letterSpacing: ".06em",
          }}
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="btn primary"
          data-testid="landing-get-started"
          style={{ padding: "7px 14px", fontSize: 12.5 }}
        >
          Get started
        </Link>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero */}
        <section
          className="gridlines"
          style={{
            padding: "72px 32px 88px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <div className="tick" style={{ marginBottom: 22 }}>
              ZERO-HALLUCINATION RAG · 4,821 RBI CIRCULARS · LIVE
            </div>
            <h1
              className="serif"
              style={{
                fontSize: 64,
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1.05,
                marginBottom: 24,
                color: "var(--ink)",
              }}
            >
              RBI regulatory intelligence, <em style={{ color: "var(--signal)" }}>cited.</em>
            </h1>
            <p
              className="serif"
              style={{
                fontSize: 20,
                fontStyle: "italic",
                color: "var(--ink-2)",
                lineHeight: 1.5,
                marginBottom: 32,
                maxWidth: 720,
                borderLeft: "2px solid var(--signal)",
                paddingLeft: 18,
              }}
            >
              Stop digging through thousands of PDFs. RegPulse delivers precise,
              cited answers to compliance questions directly from RBI&apos;s own
              circulars — with confidence scoring and a consult-expert fallback
              when the evidence isn&apos;t strong enough.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/register"
                className="btn accent"
                data-testid="landing-cta-primary"
                style={{ padding: "10px 18px", fontSize: 13.5 }}
              >
                Start free → 5 credits
              </Link>
              <Link
                href="/library"
                className="btn"
                data-testid="landing-cta-secondary"
                style={{ padding: "10px 18px", fontSize: 13.5 }}
              >
                Browse circulars
              </Link>
            </div>
          </div>
        </section>

        {/* Feature panels */}
        <section
          style={{
            padding: "72px 32px 88px",
            background: "var(--panel)",
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div className="tick" style={{ marginBottom: 8 }}>
              WHY · WHAT YOU GET
            </div>
            <h2
              className="serif"
              style={{
                fontSize: 32,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                marginBottom: 12,
                color: "var(--ink)",
              }}
            >
              Built strictly for financial institutions.
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "var(--ink-3)",
                maxWidth: 620,
                marginBottom: 36,
                lineHeight: 1.55,
              }}
            >
              We prioritise zero-hallucination factual extraction over predictive
              generation. If the answer isn&apos;t in the corpus, we say so.
            </p>

            <div
              style={{
                display: "grid",
                gap: 18,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              {features.map((f) => (
                <div
                  key={f.code}
                  className="panel"
                  style={{ padding: 22 }}
                  data-testid="landing-feature"
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--signal)",
                      marginBottom: 14,
                    }}
                  >
                    {f.code}
                  </div>
                  <div className="tick" style={{ marginBottom: 6 }}>
                    {f.tag}
                  </div>
                  <h3
                    className="serif"
                    style={{
                      fontSize: 20,
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                      marginBottom: 10,
                      color: "var(--ink)",
                    }}
                  >
                    {f.head}
                  </h3>
                  <p
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: "var(--ink-3)",
                    }}
                  >
                    {f.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer ticker */}
      <footer
        style={{
          padding: "16px 32px",
          borderTop: "1px solid var(--line)",
          background: "var(--panel-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--ink-3)",
          fontFamily: "var(--font-mono)",
          letterSpacing: ".05em",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="mono"
            style={{
              width: 20,
              height: 20,
              background: "var(--ink)",
              color: "var(--bg)",
              borderRadius: 2,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9.5,
              fontWeight: 700,
            }}
          >
            RP
          </span>
          <span className="up">
            © {new Date().getFullYear()} REGPULSE, INC · ALL RIGHTS RESERVED
          </span>
        </div>
        <span className="up">DPDP COMPLIANT · WORK EMAIL ONLY · RAG-ONLY</span>
      </footer>
    </div>
  );
}
