"use client";

import { cn } from "@/lib/cn";

export type ConfidenceBand = "high" | "medium" | "low" | "fallback";

interface ConfidenceMeterProps {
  /** 0.0–1.0. `null` means the question pre-dates Sprint 4 persistence. */
  score: number | null;
  /** When true the LLM was bypassed for the "Consult an Expert" fallback. */
  consultExpert: boolean;
  /** Compact variant — used inside list items. */
  compact?: boolean;
  className?: string;
  /** Optional data-testid that gets forwarded to the root element. */
  "data-testid"?: string;
}

/**
 * Compute the band from a confidence score. Thresholds match
 * `llm_service._compute_confidence` semantics: < 0.5 already triggers
 * the consult-expert fallback in the backend.
 */
export function bandFor(
  score: number | null,
  consultExpert: boolean,
): ConfidenceBand {
  if (consultExpert) return "fallback";
  if (score === null) return "medium";
  if (score >= 0.8) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

const bandLabel: Record<ConfidenceBand, string> = {
  high: "High confidence",
  medium: "Moderate confidence",
  low: "Low confidence",
  fallback: "Consult an expert",
};

// v2 tokens — every value resolves through CSS custom properties in
// globals.css so light/dark mode + theme switches stay coherent.
const bandTokens: Record<
  ConfidenceBand,
  { fill: string; tint: string; ink: string; ring: string }
> = {
  high: {
    fill: "var(--good)",
    tint: "var(--good-bg)",
    ink: "var(--good)",
    ring: "var(--good)",
  },
  medium: {
    fill: "var(--warn)",
    tint: "var(--warn-bg)",
    ink: "var(--warn)",
    ring: "var(--warn)",
  },
  low: {
    fill: "var(--signal)",
    tint: "var(--signal-bg)",
    ink: "var(--signal-ink)",
    ring: "var(--signal)",
  },
  fallback: {
    fill: "var(--bad)",
    tint: "var(--bad-bg)",
    ink: "var(--bad)",
    ring: "var(--bad)",
  },
};

export function ConfidenceMeter({
  score,
  consultExpert,
  compact = false,
  className,
  "data-testid": testId,
}: ConfidenceMeterProps) {
  // Pre-Sprint-4 questions have no score and no fallback. Render nothing
  // rather than misrepresent the answer with a fake number.
  if (score === null && !consultExpert) return null;

  const band = bandFor(score, consultExpert);
  const tokens = bandTokens[band];
  const displayScore = consultExpert ? 0 : score ?? 0;
  const pct = Math.round(displayScore * 100);

  if (compact) {
    return (
      <span
        className={cn("mono", className)}
        data-testid={testId}
        aria-label={`${bandLabel[band]} ${consultExpert ? "" : `(${pct}%)`}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 8px",
          borderRadius: 2,
          fontSize: 11,
          fontWeight: 500,
          background: tokens.tint,
          color: tokens.ink,
          border: `1px solid ${tokens.ring}`,
          letterSpacing: ".02em",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: tokens.fill,
            flexShrink: 0,
          }}
        />
        {consultExpert ? "CONSULT EXPERT" : `${pct}%`}
      </span>
    );
  }

  return (
    <section
      className={cn("panel", className)}
      data-testid={testId}
      aria-label="Answer confidence"
      role="group"
      style={{
        background: tokens.tint,
        borderColor: tokens.ring,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="mono up"
          style={{ fontSize: 11, fontWeight: 600, color: tokens.ink, letterSpacing: ".08em" }}
        >
          {bandLabel[band]}
        </span>
        {!consultExpert && (
          <span
            className="mono tnum"
            style={{ fontSize: 14, fontWeight: 600, color: tokens.ink }}
          >
            {pct}%
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bar"
        style={{ marginTop: 10, background: "var(--line)" }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            background: tokens.fill,
            width: consultExpert ? "100%" : `${pct}%`,
            transition: "width .2s",
          }}
        />
      </div>

      <p
        style={{
          marginTop: 10,
          fontSize: 12,
          lineHeight: 1.45,
          color: tokens.ink,
        }}
      >
        {consultExpert
          ? "RegPulse could not find sufficient evidence in the indexed RBI circulars. Validate this answer with your Chief Compliance Officer before acting."
          : band === "high"
            ? "Strong citation coverage and direct support from the retrieved circulars."
            : band === "medium"
              ? "Reasonable support from circulars, but some signals were weaker. Verify the citations."
              : "Limited citation coverage. Treat as preliminary and confirm with expert review."}
      </p>
    </section>
  );
}
