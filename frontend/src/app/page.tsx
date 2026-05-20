import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingScrollHint } from "@/components/landing/LandingScrollHint";
import { CIRCULARS, FEATURES, STEPS, TESTIMONIALS } from "@/components/landing/landingData";
import "./landing.css";

function LightningIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
      />
    </svg>
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <div className="landing-page min-h-screen font-sans">
      <LandingNavbar />

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-eyebrow">
          <div className="landing-eyebrow-dot" />
          Powered by RBI Circular Database v4.2
        </div>

        <h1 className="landing-hero-h1">
          RBI Regulatory Intelligence,
          <br />
          <span className="accent">Instantly.</span>
        </h1>

        <p className="landing-hero-sub">
          Stop digging through thousands of PDFs. RegPulse uses advanced AI to deliver precise, cited
          answers to your complex compliance questions — directly from the RBI&apos;s own circulars.
        </p>

        <div className="landing-hero-ctas">
          <Link href="/register" className="landing-btn-hero-primary">
            <LightningIcon />
            Start for Free
          </Link>
          <Link href="/library" className="landing-btn-hero-ghost">
            <DocumentIcon />
            Browse Circulars
          </Link>
        </div>

        <div className="landing-hero-stats">
          <div className="landing-stat-item">
            <div className="landing-stat-num">
              2,400<span>+</span>
            </div>
            <div className="landing-stat-label">Circulars Indexed</div>
          </div>
          <div className="landing-stat-divider" />
          <div className="landing-stat-item">
            <div className="landing-stat-num">
              98<span>%</span>
            </div>
            <div className="landing-stat-label">Interpretation Accuracy</div>
          </div>
          <div className="landing-stat-divider" />
          <div className="landing-stat-item">
            <div className="landing-stat-num">
              <span>&lt;</span>3s
            </div>
            <div className="landing-stat-label">Average Response Time</div>
          </div>
          <div className="landing-stat-divider" />
          <div className="landing-stat-item">
            <div className="landing-stat-num">
              500<span>+</span>
            </div>
            <div className="landing-stat-label">Compliance Teams</div>
          </div>
        </div>

        <LandingScrollHint />
      </section>

      {/* Features */}
      <section id="features" style={{ background: "var(--bg)" }}>
        <div className="landing-section">
          <div className="landing-section-eyebrow">Why RegPulse</div>
          <h2 className="landing-section-title">
            Built for compliance
            <br />
            professionals.
          </h2>
          <p className="landing-section-sub">
            Everything you need to navigate RBI regulations without the noise — precise, cited, and
            always current.
          </p>
          <div className="landing-section-divider" />

          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">{f.icon}</div>
                <div className="landing-feature-title">{f.title}</div>
                <p className="landing-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="landing-alt-bg">
        <div className="landing-section">
          <div className="landing-section-eyebrow">How it Works</div>
          <h2 className="landing-section-title">Three steps to clarity.</h2>
          <p className="landing-section-sub">
            RegPulse is designed to deliver answers in seconds, not hours of manual research.
          </p>
          <div className="landing-section-divider" />
          <div className="landing-steps-row">
            {STEPS.map((step) => (
              <div key={step.num} className="landing-step-item">
                <div className="landing-step-num">{step.num}</div>
                <div className="landing-step-title">{step.title}</div>
                <p className="landing-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Circulars */}
      <section id="circulars" style={{ background: "var(--bg)" }}>
        <div className="landing-section">
          <div className="landing-section-eyebrow">Document Repository</div>
          <h2 className="landing-section-title">
            2,400+ circulars.
            <br />
            Fully indexed.
          </h2>
          <p className="landing-section-sub">
            Every RBI master direction, circular, and notification — tagged, searchable, and always up
            to date.
          </p>
          <div className="landing-section-divider" />
          <div className="landing-circulars-preview">
            <div className="landing-cp-header">
              <div className="landing-cp-title">Recent & Updated Circulars</div>
              <div className="landing-cp-live">
                <div className="landing-live-dot" />
                Live updates enabled
              </div>
            </div>
            {CIRCULARS.map((row) => (
              <Link
                key={row.id}
                href="/library"
                className="landing-circular-row"
                style={{ textDecoration: "none" }}
              >
                <div className={`landing-cr-dot${row.isNew ? " new" : ""}`} />
                <div className="landing-cr-id">{row.id}</div>
                <div className="landing-cr-title">{row.title}</div>
                <div className="landing-cr-date">{row.date}</div>
                <span className={`landing-cr-badge ${row.badgeClass}`}>{row.badge}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="landing-alt-bg">
        <div className="landing-section">
          <div className="landing-section-eyebrow">Testimonials</div>
          <h2 className="landing-section-title">Trusted by compliance teams.</h2>
          <p className="landing-section-sub">
            From fintech startups to large NBFCs — teams use RegPulse to stay ahead of RBI
            regulations.
          </p>
          <div className="landing-section-divider" />
          <div className="landing-testimonials-grid">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="landing-testi-card">
                <div className="landing-testi-stars">★★★★★</div>
                <p className="landing-testi-quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="landing-testi-author">
                  <div className="landing-testi-avatar">{t.initials}</div>
                  <div>
                    <div className="landing-testi-name">{t.name}</div>
                    <div className="landing-testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section">
        <div className="landing-cta-card">
          <div className="landing-section-eyebrow" style={{ marginBottom: 16 }}>
            Get Started Today
          </div>
          <h2 className="landing-cta-title">
            Ready to simplify
            <br />
            RBI compliance?
          </h2>
          <p className="landing-cta-sub">
            Join 500+ compliance teams using RegPulse to interpret RBI circulars accurately,
            instantly, and with confidence.
          </p>
          <div className="landing-cta-btns">
            <Link href="/register" className="landing-btn-hero-primary">
              <LightningIcon />
              Start for Free
            </Link>
            <Link href="/login" className="landing-btn-hero-ghost" style={{ background: "var(--bg)" }}>
              Schedule a Demo
            </Link>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
            No credit card required · 475 free credits to start
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-wordmark-f">
              Reg<span>Pulse</span>
            </div>
            <p>RBI Compliance Intelligence — precise answers from the source, not summaries.</p>
          </div>
          <div className="landing-footer-links">
            <div className="landing-footer-col">
              <h4>Product</h4>
              <Link href="/ask">Ask RegPulse</Link>
              <Link href="/library">Document Repository</Link>
              <Link href="/updates">Regulatory Alerts</Link>
              <Link href="/action-items">Action Items</Link>
            </div>
            <div className="landing-footer-col">
              <h4>Company</h4>
              <a href="#features">About</a>
              <a href="#testimonials">Blog</a>
              <a href="#circulars">Careers</a>
              <a href="/login">Contact</a>
            </div>
            <div className="landing-footer-col">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <div className="landing-footer-copy">
            © {year} RegPulse · think360.ai · All rights reserved.
          </div>
          <div className="landing-footer-legal">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Sitemap</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
