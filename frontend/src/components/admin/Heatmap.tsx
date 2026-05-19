/**
 * Heatmap — semantic cluster × time grid. v2 terminal-modern (S7b2b).
 *
 * Cells are coloured by question count using a paper → signal interpolation
 * (light) / panel-2 → signal (dark). Hover tooltip shows cluster + date +
 * count; clicking a cluster row toggles the representative-questions block.
 */

"use client";

import { useState } from "react";

interface HeatmapProps {
  clusters: {
    id: string;
    label: string;
    question_count: number;
    representative_questions: string[];
  }[];
  time_buckets: string[];
  matrix: number[][];
}

// Interpolate from (paper bg) → (signal amber) on light mode,
// and from (panel-2) → (signal) on dark. The "no data" cell stays at the
// base background.
function cellColor(value: number, max: number, isDark: boolean): string {
  if (max === 0 || value === 0) {
    // panel-2 in light = #f1efe7 ; in dark = #1a1c20
    return isDark ? "#1a1c20" : "#f1efe7";
  }
  const ratio = Math.min(value / max, 1);
  // signal in light = #c25a11 (rgb 194,90,17), in dark = #f0a24a (rgb 240,162,74)
  if (isDark) {
    // dark base (26,28,32) → signal (240,162,74)
    const r = Math.round(26 + (240 - 26) * ratio);
    const g = Math.round(28 + (162 - 28) * ratio);
    const b = Math.round(32 + (74 - 32) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // light base (241,239,231) → signal (194,90,17)
  const r = Math.round(241 + (194 - 241) * ratio);
  const g = Math.round(239 + (90 - 239) * ratio);
  const b = Math.round(231 + (17 - 231) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Heatmap({ clusters, time_buckets, matrix }: HeatmapProps) {
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    date: string;
    count: number;
  } | null>(null);

  if (clusters.length === 0) {
    return (
      <div
        className="panel"
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--ink-3)",
        }}
      >
        No clustering data available. Run clustering first.
      </div>
    );
  }

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const maxVal = Math.max(...matrix.flat(), 1);

  return (
    <div style={{ overflowX: "auto" }} data-testid="heatmap-grid">
      <div
        className="mono up"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontSize: 10,
          color: "var(--ink-4)",
          letterSpacing: ".06em",
        }}
      >
        <span>LESS</span>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <div
            key={ratio}
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              border: "1px solid var(--line)",
              backgroundColor: cellColor(ratio * maxVal, maxVal, isDark),
            }}
          />
        ))}
        <span>MORE</span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: `220px repeat(${time_buckets.length}, minmax(28px, 1fr))`,
          background: "var(--line)",
          padding: 1,
          borderRadius: 2,
        }}
      >
        <div style={{ background: "var(--panel)" }} />
        {time_buckets.map((d) => (
          <div
            key={d}
            className="mono"
            style={{
              background: "var(--panel)",
              textAlign: "center",
              fontSize: 10,
              color: "var(--ink-4)",
              padding: "4px 0",
            }}
          >
            {formatDateShort(d)}
          </div>
        ))}

        {clusters.map((cluster, ci) => (
          <div key={cluster.id} style={{ display: "contents" }}>
            <button
              onClick={() =>
                setExpandedCluster(expandedCluster === ci ? null : ci)
              }
              data-testid="heatmap-cluster-label"
              title={cluster.label}
              style={{
                background: "var(--panel)",
                display: "flex",
                alignItems: "center",
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-2)",
                textAlign: "left",
                overflow: "hidden",
                cursor: "pointer",
                border: 0,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {cluster.label}
              </span>
              <span
                className="mono tnum"
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: "var(--ink-4)",
                }}
              >
                ({cluster.question_count})
              </span>
            </button>

            {time_buckets.map((d, di) => {
              const count = matrix[ci]?.[di] ?? 0;
              return (
                <div
                  key={`${cluster.id}-${d}`}
                  data-testid="heatmap-cell"
                  style={{
                    height: 28,
                    background: cellColor(count, maxVal, isDark),
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    const rect = (
                      e.target as HTMLElement
                    ).getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      label: cluster.label,
                      date: d,
                      count,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}

            {expandedCluster === ci && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  background: "var(--panel-2)",
                  padding: "10px 14px",
                  color: "var(--ink-2)",
                }}
              >
                <div
                  className="mono up"
                  style={{
                    fontSize: 10,
                    color: "var(--ink-4)",
                    letterSpacing: ".08em",
                    marginBottom: 6,
                  }}
                >
                  REPRESENTATIVE QUESTIONS
                </div>
                <ul
                  style={{
                    listStyleType: "disc",
                    paddingLeft: 18,
                    margin: 0,
                  }}
                >
                  {cluster.representative_questions.map((q, qi) => (
                    <li
                      key={qi}
                      className="serif"
                      style={{ fontSize: 13, marginBottom: 4 }}
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="mono"
          style={{
            position: "fixed",
            zIndex: 50,
            pointerEvents: "none",
            background: "var(--ink)",
            color: "var(--bg)",
            padding: "5px 10px",
            fontSize: 11,
            borderRadius: 2,
            boxShadow: "var(--shadow-lg)",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.label} · {tooltip.date} ·{" "}
          <strong className="tnum">{tooltip.count}</strong> questions
        </div>
      )}
    </div>
  );
}
