/**
 * Admin circulars — v2 terminal-modern (S7b1).
 *
 * Pending-summary approval queue. Each row shows the circular number + title;
 * "Approve" promotes the AI summary to public display.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Btn } from "@/components/design/Primitives";
import type { CircularListItem } from "@/types";

function usePendingSummaries() {
  return useQuery({
    queryKey: ["admin", "circulars", "pending"],
    queryFn: async () => {
      const { data } = await api.get("/admin/circulars/pending-summaries", {
        params: { page: 1, page_size: 50 },
      });
      return data as { data: CircularListItem[]; total: number };
    },
  });
}

export default function AdminCircularsPage() {
  const { data, isLoading } = usePendingSummaries();
  const qc = useQueryClient();

  const approve = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/circulars/${id}/approve-summary`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "circulars"] }),
  });

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING PENDING SUMMARIES…
      </div>
    );
  }

  const total = data?.total ?? 0;
  const items = data?.data ?? [];

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-circulars">
      <div className="tick" style={{ marginBottom: 8 }}>
        ADMIN · CIRCULAR SUMMARIES · AWAITING APPROVAL
      </div>
      <h1
        className="serif"
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          marginBottom: 4,
        }}
      >
        Pending summaries.
      </h1>
      <p
        className="mono"
        style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 22 }}
      >
        {total} OPEN · AI-GENERATED SUMMARIES AWAITING ADMIN SIGN-OFF
      </p>

      {items.length === 0 && (
        <div
          className="panel"
          style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}
        >
          All summaries approved. Queue clear.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((c) => (
          <div
            key={c.id}
            className="panel"
            style={{ padding: 14 }}
            data-testid="admin-circular-row"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    background: "var(--panel-2)",
                    padding: "3px 8px",
                    borderRadius: 2,
                  }}
                >
                  {c.circular_number ?? "—"}
                </span>
                <p
                  className="serif"
                  style={{
                    marginTop: 8,
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.title}
                </p>
              </div>
              <Btn
                variant="primary"
                size="sm"
                disabled={approve.isPending}
                onClick={() => approve.mutate(c.id)}
                data-testid="admin-circular-approve"
              >
                Approve
              </Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
