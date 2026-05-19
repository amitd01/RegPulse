/**
 * Public snippet page — /s/[slug]  (S8b: v2 terminal-modern port)
 *
 * Server component, no auth. Renders the safe redacted snippet from
 * snippet_service. detailed_interpretation never leaves the backend
 * (rule 11). Open Graph metadata drives LinkedIn/X previews.
 *
 * No `bg-navy-*` / `text-navy-*` / `slate-*` / `bg-blue-*` / `bg-gray-*`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPublicSnippet } from "@/lib/api/snippets";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const snippet = await fetchPublicSnippet(slug);

  if (!snippet) {
    return { title: "Snippet not found — RegPulse" };
  }

  const title = snippet.consult_expert
    ? "RegPulse — Compliance question requires expert review"
    : "RegPulse — RBI compliance answer";
  const description = snippet.snippet_text.slice(0, 200);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: snippet.og_image_url, width: 1200, height: 630 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [snippet.og_image_url],
    },
  };
}

export default async function PublicSnippetPage({ params }: PageProps) {
  const { slug } = await params;
  const snippet = await fetchPublicSnippet(slug);

  if (!snippet) {
    notFound();
  }

  const registerUrl = `/register?utm_source=share&utm_medium=snippet&slug=${slug}`;

  const isConsult = snippet.consult_expert;

  return (
    <main
      className="gridlines"
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
        padding: "48px 24px 80px",
      }}
      data-testid="snippet-page"
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Brand header */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 30,
            textDecoration: "none",
          }}
          data-testid="snippet-brand"
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

        {/* Tag pill */}
        <div style={{ marginBottom: 18 }}>
          <span
            className="pill"
            style={
              isConsult
                ? {
                    background: "var(--warn-bg)",
                    color: "var(--warn)",
                    borderColor: "transparent",
                  }
                : {
                    background: "var(--signal-bg)",
                    color: "var(--signal-ink)",
                    borderColor: "transparent",
                  }
            }
            data-testid="snippet-status-pill"
          >
            {isConsult ? "CONSULT AN EXPERT" : "RBI COMPLIANCE ANSWER · PREVIEW"}
          </span>
        </div>

        {/* Snippet card */}
        <article
          className="panel"
          style={{ padding: 28, marginBottom: 24, boxShadow: "var(--shadow)" }}
          data-testid="snippet-card"
        >
          <p
            className="serif"
            style={{
              fontSize: 19,
              fontStyle: "italic",
              lineHeight: 1.55,
              color: "var(--ink-2)",
              borderLeft: "2px solid var(--signal)",
              paddingLeft: 18,
            }}
          >
            {snippet.snippet_text}
          </p>

          {snippet.top_citation && (
            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div className="tick" style={{ marginBottom: 6 }}>
                SOURCE
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                  background: "var(--panel-2)",
                  padding: "4px 8px",
                  borderRadius: 2,
                  display: "inline-block",
                  marginBottom: 10,
                }}
              >
                {snippet.top_citation.circular_number}
                {snippet.top_citation.section_reference && (
                  <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>
                    {" · §"}
                    {snippet.top_citation.section_reference}
                  </span>
                )}
              </div>
              <p
                className="serif"
                style={{
                  fontSize: 14,
                  fontStyle: "italic",
                  color: "var(--ink-3)",
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{snippet.top_citation.verbatim_quote}&rdquo;
              </p>
            </div>
          )}
        </article>

        {/* CTA */}
        <div
          className="panel"
          style={{
            padding: 22,
            textAlign: "center",
            background: "var(--panel-2)",
          }}
          data-testid="snippet-cta"
        >
          <h2
            className="serif"
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            Get the full compliance answer.
          </h2>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--ink-3)",
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            {snippet.register_cta}
          </p>
          <Link
            href={registerUrl}
            className="btn accent"
            style={{ padding: "10px 18px", fontSize: 13.5 }}
            data-testid="snippet-cta-register"
          >
            Register on RegPulse →
          </Link>
        </div>

        <p
          className="mono"
          style={{
            marginTop: 28,
            textAlign: "center",
            fontSize: 10.5,
            color: "var(--ink-4)",
            letterSpacing: ".05em",
            textTransform: "uppercase",
          }}
        >
          RAG · 3-LAYER ANTI-HALLUCINATION · CITATION-LOCKED · DPDP COMPLIANT
        </p>
      </div>
    </main>
  );
}
