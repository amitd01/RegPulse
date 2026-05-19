/**
 * Auth layout — v2 terminal-modern. Replaces the pre-rebuild navy gradient
 * card with a paper-on-paper panel and the editorial RegPulse brand mark.
 *
 * No `bg-navy-*` / `text-navy-*` / `slate-*` Tailwind classes (rule 15).
 */

import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="gridlines"
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "20px 32px",
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
              letterSpacing: 0,
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
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div
          className="panel"
          style={{
            width: "100%",
            maxWidth: 440,
            padding: "32px 32px 28px",
            boxShadow: "var(--shadow)",
          }}
        >
          {children}
        </div>
      </main>

      <footer
        style={{
          padding: "14px 32px",
          borderTop: "1px solid var(--line)",
          background: "var(--panel-2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "var(--ink-3)",
          fontFamily: "var(--font-mono)",
          letterSpacing: ".05em",
        }}
      >
        <span className="up">© REGPULSE · ALL RIGHTS RESERVED</span>
        <span className="up">WORK EMAIL · OTP · DPDP COMPLIANT</span>
      </footer>
    </div>
  );
}
