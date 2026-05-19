/**
 * Admin review queue — v2 terminal-modern (S7a).
 *
 * Each flagged question rendered as a panel with the question (serif), the
 * quick answer (mono small), an override textarea (.input), and the
 * Save Override / Mark Reviewed actions as v2 Btns.
 *
 * Wiring preserved: useFlaggedQuestions, useOverride, useMarkReviewed.
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Btn } from "@/components/design/Primitives";
import type { QuestionSummary } from "@/types";

function useFlaggedQuestions(page: number) {
  return useQuery({
    queryKey: ["admin", "review", page],
    queryFn: async () => {
      const { data } = await api.get("/admin/review", {
        params: { feedback: -1, reviewed: false, page, page_size: 20 },
      });
      return data as { data: QuestionSummary[]; total: number };
    },
  });
}

function useOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      await api.patch(`/admin/review/${id}/override`, { admin_override: text });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "review"] }),
  });
}

function useMarkReviewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/admin/review/${id}/mark-reviewed`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "review"] }),
  });
}

export default function ReviewPage() {
  const [page] = useState(1);
  const { data, isLoading } = useFlaggedQuestions(page);
  const override = useOverride();
  const markReviewed = useMarkReviewed();
  const [overrideText, setOverrideText] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING REVIEW QUEUE…
      </div>
    );
  }

  const total = data?.total ?? 0;
  const items = data?.data ?? [];

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-review">
      <div className="tick" style={{ marginBottom: 8 }}>
        ADMIN · REVIEW QUEUE · FLAGGED QUESTIONS
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
        Flagged for review.
      </h1>
      <p
        className="mono"
        style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 22 }}
      >
        {total} OPEN · THUMBS-DOWN FEEDBACK, AWAITING ADMIN OVERRIDE
      </p>

      {items.length === 0 && (
        <div
          className="panel"
          style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}
        >
          No flagged questions in the queue. Good day.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((q) => (
          <div
            key={q.id}
            className="panel"
            style={{ padding: 16 }}
            data-testid="admin-review-row"
          >
            <p
              className="serif"
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "var(--ink)",
                lineHeight: 1.35,
              }}
            >
              {q.question_text}
            </p>
            {q.quick_answer && (
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-3)",
                  marginTop: 6,
                  lineHeight: 1.45,
                }}
              >
                {q.quick_answer}
              </p>
            )}

            <textarea
              placeholder="Override answer…"
              value={overrideText[q.id] ?? ""}
              onChange={(e) =>
                setOverrideText((p) => ({ ...p, [q.id]: e.target.value }))
              }
              rows={3}
              className="input"
              data-testid="admin-override-input"
              style={{ marginTop: 12, fontFamily: "var(--font-serif)", fontSize: 14 }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn
                variant="primary"
                size="sm"
                disabled={!overrideText[q.id] || override.isPending}
                onClick={() =>
                  override.mutate({ id: q.id, text: overrideText[q.id] ?? "" })
                }
                data-testid="admin-save-override"
              >
                {override.isPending ? "Saving…" : "Save override"}
              </Btn>
              <Btn
                size="sm"
                disabled={markReviewed.isPending}
                onClick={() => markReviewed.mutate(q.id)}
                data-testid="admin-mark-reviewed"
              >
                Mark reviewed
              </Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
