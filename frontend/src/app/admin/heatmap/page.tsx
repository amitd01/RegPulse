/**
 * Admin heatmap — v2 terminal-modern (S7b2b).
 *
 * Semantic-clustering visualisation: question clusters × time buckets.
 * Backend computes via sklearn weekly Celery beat; admin can also trigger
 * an on-demand refresh.
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Btn } from "@/components/design/Primitives";
import Heatmap from "@/components/admin/Heatmap";

interface ClusterInfo {
  id: string;
  label: string;
  question_count: number;
  representative_questions: string[];
}

interface HeatmapData {
  success: boolean;
  clusters: ClusterInfo[];
  time_buckets: string[];
  matrix: number[][];
}

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

export default function HeatmapPage() {
  const [periodDays, setPeriodDays] = useState(30);
  const [timeBucket, setTimeBucket] = useState<"day" | "week">("day");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "heatmap", periodDays, timeBucket],
    queryFn: async () => {
      const { data } = await api.get("/admin/dashboard/heatmap", {
        params: { period_days: periodDays, time_bucket: timeBucket },
      });
      return data as HeatmapData;
    },
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(
        "/admin/dashboard/heatmap/refresh",
        null,
        { params: { period_days: periodDays } },
      );
      return data as { message?: string };
    },
    onSuccess: (data) => {
      toast.success(data.message ?? "Clustering queued");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin", "heatmap"] });
      }, 3000);
    },
  });

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-heatmap">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <div>
          <div className="tick" style={{ marginBottom: 8 }}>
            ADMIN · QUESTION CLUSTERS × TIME · SEMANTIC GROUPS
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Query heatmap.
          </h1>
        </div>
        <Btn
          variant="primary"
          size="sm"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
          data-testid="heatmap-refresh"
        >
          {refresh.isPending ? "Queuing…" : "Refresh clusters"}
        </Btn>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          margin: "20px 0 22px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="mono up"
            style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: ".06em" }}
          >
            Period
          </span>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="input"
            data-testid="heatmap-period"
            style={{ width: 130, padding: "6px 8px", fontSize: 12.5 }}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="mono up"
            style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: ".06em" }}
          >
            Group by
          </span>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid var(--line-2)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {(["day", "week"] as const).map((bucket) => (
              <button
                key={bucket}
                onClick={() => setTimeBucket(bucket)}
                data-testid={`heatmap-bucket-${bucket}`}
                style={{
                  padding: "6px 12px",
                  fontSize: 11.5,
                  textTransform: "capitalize",
                  background:
                    timeBucket === bucket ? "var(--ink)" : "var(--panel)",
                  color: timeBucket === bucket ? "var(--bg)" : "var(--ink-3)",
                  cursor: "pointer",
                  border: 0,
                }}
              >
                {bucket}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div
          className="tick"
          style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
        >
          LOADING CLUSTERS…
        </div>
      ) : data ? (
        <Heatmap
          clusters={data.clusters}
          time_buckets={data.time_buckets}
          matrix={data.matrix}
        />
      ) : null}
    </div>
  );
}
