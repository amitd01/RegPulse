/**
 * Circular detail — v2 terminal-modern. Slice 4a.
 *
 * Reverses the pre-rebuild chunk-card-dump pattern (rule 16 / ADR A30).
 * Renders `circular.structured_content` (reading-shape JSONB tree) as proper
 * typography: serif body, heading hierarchy, .dtable tables, semantic lists.
 *
 * When `structured_content` is null (circular hasn't been re-processed by
 * slice 4b's structural extractor yet), shows a "preview not available"
 * fallback that points the user at the RBI source URL — we do NOT render
 * raw chunks anymore.
 */

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Pill, Icon } from "@/components/design/Primitives";
import { useCircularDetail } from "@/hooks/useCirculars";
import type { StructuredBlock } from "@/types";

const impactTone = (level?: string | null): "amber" | "warn" | "good" | "" => {
  if (level === "HIGH") return "amber";
  if (level === "MEDIUM") return "warn";
  if (level === "LOW") return "good";
  return "";
};

const statusTone = (status: string): "good" | "bad" | "ghost" => {
  if (status === "ACTIVE") return "good";
  if (status === "SUPERSEDED") return "bad";
  return "ghost";
};

function StructuredRenderer({ block }: { block: StructuredBlock }) {
  switch (block.type) {
    case "heading": {
      const fontSize = block.level === 1 ? 26 : block.level === 2 ? 19 : 16;
      const marginTop = block.level === 1 ? 0 : block.level === 2 ? 24 : 14;
      return (
        <h2
          className="serif"
          style={{
            fontSize,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            marginTop,
            marginBottom: 8,
            lineHeight: 1.25,
          }}
        >
          {block.text}
        </h2>
      );
    }

    case "paragraph":
      return <p>{block.text}</p>;

    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          style={{
            margin: "12px 0 14px 24px",
            paddingLeft: 4,
            listStyleType: block.ordered ? "decimal" : "disc",
          }}
        >
          {block.items.map((item, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              <StructuredRenderer block={item} />
            </li>
          ))}
        </Tag>
      );
    }

    case "table":
      return (
        <div style={{ overflowX: "auto", margin: "14px 0 18px" }}>
          <table className="dtable">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

export default function CircularDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading, isError } = useCircularDetail(id);

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING CIRCULAR…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: "24px 32px" }}>
        <div
          className="panel"
          style={{
            padding: 20,
            borderColor: "var(--bad)",
            background: "var(--bad-bg)",
            color: "var(--bad)",
          }}
        >
          Circular not found or failed to load.
        </div>
        <Link
          href="/library"
          style={{
            marginTop: 16,
            display: "inline-block",
            color: "var(--ink-2)",
            borderBottom: "1px solid var(--signal)",
          }}
        >
          ← Back to library
        </Link>
      </div>
    );
  }

  const c = data.data;

  const fmtDate = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  const blocks = c.structured_content?.blocks ?? [];

  return (
    <div style={{ padding: "20px 32px 64px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <Link
        href="/library"
        className="tick"
        style={{ marginBottom: 18, display: "inline-flex" }}
      >
        ← LIBRARY · ALL CIRCULARS
      </Link>

      {/* Identification strip */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {c.circular_number && (
          <span
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-2)",
              background: "var(--panel-2)",
              padding: "3px 8px",
              borderRadius: 2,
            }}
          >
            {c.circular_number}
          </span>
        )}
        <Pill tone={statusTone(c.status)}>{c.status}</Pill>
        {c.impact_level && (
          <Pill tone={impactTone(c.impact_level)}>{c.impact_level} IMPACT</Pill>
        )}
        <span className="tick" style={{ marginLeft: 6 }}>
          {c.doc_type.replace(/_/g, " ")}
        </span>
      </div>

      {/* Editorial title */}
      <h1
        className="serif"
        style={{
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
          marginBottom: 18,
          color: "var(--ink)",
        }}
      >
        {c.title}
      </h1>

      {/* Spec sheet */}
      <div
        className="panel"
        style={{
          padding: 16,
          marginBottom: 22,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14,
          background: "var(--panel-2)",
        }}
      >
        <SpecCell label="ISSUED" value={fmtDate(c.issued_date)} />
        <SpecCell label="EFFECTIVE" value={fmtDate(c.effective_date)} />
        <SpecCell label="DEPARTMENT" value={c.department ?? "—"} />
        <SpecCell label="ACTION DEADLINE" value={fmtDate(c.action_deadline)} />
      </div>

      {/* AI summary as editorial deck */}
      {c.ai_summary && !c.pending_admin_review && (
        <div className="prose" style={{ marginBottom: 28 }}>
          <p className="dek">{c.ai_summary}</p>
        </div>
      )}
      {c.pending_admin_review && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--warn-bg)",
            color: "var(--warn)",
            fontSize: 12.5,
            borderRadius: "var(--radius-2)",
            marginBottom: 22,
          }}
        >
          AI summary is pending admin review.
        </div>
      )}

      {/* Affected teams + tags */}
      {((c.affected_teams && c.affected_teams.length > 0) ||
        (c.tags && c.tags.length > 0)) && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 28 }}>
          {c.affected_teams && c.affected_teams.length > 0 && (
            <Sidebar label="AFFECTED TEAMS" items={c.affected_teams} />
          )}
          {c.tags && c.tags.length > 0 && (
            <Sidebar label="TAGS" items={c.tags} />
          )}
        </div>
      )}

      {/* Source link */}
      <a
        href={c.rbi_url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn"
        style={{ marginBottom: 28 }}
        data-testid="rbi-source-link"
      >
        <Icon.Arrow /> View original on rbi.org.in
      </a>

      {/* The actual document */}
      <hr className="hr" style={{ margin: "8px 0 24px" }} />
      <div className="tick" style={{ marginBottom: 16 }}>
        DOCUMENT · STRUCTURED VIEW
      </div>

      {blocks.length > 0 ? (
        <div className="prose" data-testid="structured-content">
          {blocks.map((block, i) => (
            <StructuredRenderer key={i} block={block} />
          ))}
        </div>
      ) : (
        <div
          className="panel"
          style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}
          data-testid="structured-content-unavailable"
        >
          <p style={{ marginBottom: 10 }}>
            Structured preview not available for this circular yet.
          </p>
          <p style={{ fontSize: 13 }}>
            Open the source PDF on{" "}
            <a
              href={c.rbi_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--ink)", borderBottom: "1px solid var(--signal)" }}
            >
              rbi.org.in
            </a>{" "}
            for the full text. The structural extractor lands in the next rebuild
            slice.
          </p>
        </div>
      )}
    </div>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="mono up"
        style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 4 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Sidebar({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div
        className="mono up"
        style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 6 }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item) => (
          <Pill key={item}>{item}</Pill>
        ))}
      </div>
    </div>
  );
}
