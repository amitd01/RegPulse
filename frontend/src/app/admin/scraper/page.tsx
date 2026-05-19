/**
 * Admin scraper — v2 terminal-modern (S7b1).
 *
 * Trigger controls for priority/full scrapes plus a feed of recent runs
 * with status pill + counts + error tail (when present).
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Btn, Pill } from "@/components/design/Primitives";

interface ScraperRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  documents_processed: number;
  documents_failed: number;
  error_message: string | null;
}

function useScraperRuns() {
  return useQuery({
    queryKey: ["admin", "scraper"],
    queryFn: async () => {
      const { data } = await api.get("/admin/scraper/runs", {
        params: { page: 1, page_size: 20 },
      });
      return data as { data: ScraperRun[]; total: number };
    },
  });
}

const statusTone = (s: string): "good" | "bad" | "warn" | "" => {
  if (s === "COMPLETED") return "good";
  if (s === "FAILED") return "bad";
  if (s === "RUNNING") return "warn";
  return "";
};

export default function ScraperPage() {
  const { data, isLoading } = useScraperRuns();
  const qc = useQueryClient();

  const trigger = useMutation({
    mutationFn: async (mode: string) => {
      const { data } = await api.post("/admin/scraper/trigger", null, {
        params: { mode },
      });
      return data as { message?: string };
    },
    onSuccess: (data) => {
      toast.success(data.message ?? "Scrape triggered");
      qc.invalidateQueries({ queryKey: ["admin", "scraper"] });
    },
  });

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING SCRAPER RUNS…
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-scraper">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="tick" style={{ marginBottom: 8 }}>
            ADMIN · SCRAPER · CELERY PIPELINE
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Scraper runs.
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn
            variant="primary"
            size="sm"
            disabled={trigger.isPending}
            onClick={() => trigger.mutate("priority")}
            data-testid="scraper-trigger-priority"
          >
            Priority scrape
          </Btn>
          <Btn
            size="sm"
            disabled={trigger.isPending}
            onClick={() => trigger.mutate("full")}
            data-testid="scraper-trigger-full"
          >
            Full scrape
          </Btn>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {data?.data.map((run) => (
          <div
            key={run.id}
            className="panel"
            style={{ padding: 14 }}
            data-testid="admin-scraper-row"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Pill tone={statusTone(run.status)}>{run.status}</Pill>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--ink-3)" }}
                >
                  {new Date(run.started_at).toLocaleString("en-IN")}
                </span>
              </div>
              <div
                className="mono tnum"
                style={{ fontSize: 11.5, color: "var(--ink-3)" }}
              >
                {run.documents_processed} PROCESSED ·{" "}
                <span
                  style={{
                    color: run.documents_failed > 0 ? "var(--bad)" : "var(--ink-3)",
                  }}
                >
                  {run.documents_failed} FAILED
                </span>
              </div>
            </div>
            {run.error_message && (
              <p
                className="mono"
                style={{
                  marginTop: 8,
                  fontSize: 11.5,
                  color: "var(--bad)",
                  lineHeight: 1.45,
                  background: "var(--bad-bg)",
                  padding: "8px 10px",
                  borderRadius: 2,
                  whiteSpace: "pre-wrap",
                }}
              >
                {run.error_message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
