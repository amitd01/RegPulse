/**
 * Question history detail — v2 terminal-modern (slice 4 / S6).
 *
 * Closes the MVP journey loop: a saved or historical question reopens with
 * the same editorial prose + citations + recommended-actions layout as the
 * live Ask page, just hydrated from the persisted Question row instead of
 * an SSE stream.
 *
 * Wiring preserved verbatim: useQuestionDetail, useSubmitFeedback,
 * ShareSnippetDialog, trackEvent on confidence-meter-viewed.
 */

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Btn, Icon, Pill } from "@/components/design/Primitives";
import { ShareSnippetDialog } from "@/components/ShareSnippetDialog";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { trackEvent } from "@/lib/analytics";
import { useQuestionDetail, useSubmitFeedback } from "@/hooks/useQuestions";

const riskTone = (risk?: string | null): "amber" | "warn" | "good" | "" => {
  if (risk === "HIGH") return "amber";
  if (risk === "MEDIUM") return "warn";
  if (risk === "LOW") return "good";
  return "";
};

const priorityTone = (p: string): "amber" | "warn" | "good" | "" => {
  if (p === "HIGH") return "amber";
  if (p === "MEDIUM") return "warn";
  if (p === "LOW") return "good";
  return "";
};

export default function QuestionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [shareOpen, setShareOpen] = useState(false);

  const { data, isLoading, isError } = useQuestionDetail(id);
  const feedbackMutation = useSubmitFeedback();

  const firedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.data) return;
    if (firedForRef.current === data.data.id) return;
    firedForRef.current = data.data.id;
    if (data.data.confidence_score !== null || data.data.consult_expert) {
      trackEvent("confidence_meter_viewed", {
        confidence_score: data.data.confidence_score,
        consult_expert: data.data.consult_expert,
        source: "history_detail",
      });
    }
  }, [data]);

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING QUESTION…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: "24px 32px" }} data-testid="history-detail-error">
        <div
          className="panel"
          style={{
            padding: 20,
            borderColor: "var(--bad)",
            background: "var(--bad-bg)",
            color: "var(--bad)",
          }}
        >
          Question not found or failed to load.
        </div>
        <Link
          href="/history"
          style={{
            marginTop: 16,
            display: "inline-block",
            color: "var(--ink-2)",
            borderBottom: "1px solid var(--signal)",
          }}
        >
          ← Back to history
        </Link>
      </div>
    );
  }

  const q = data.data;

  const formattedTime = new Date(q.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{ padding: "20px 32px 64px", maxWidth: 1000, margin: "0 auto" }}
      data-testid="history-detail"
    >
      {/* Breadcrumb */}
      <Link
        href="/history"
        className="tick"
        style={{ marginBottom: 18, display: "inline-flex" }}
      >
        ← HISTORY · ALL QUESTIONS
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
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            background: "var(--panel-2)",
            padding: "3px 8px",
            borderRadius: 2,
          }}
        >
          {formattedTime}
        </span>
        {q.risk_level && (
          <Pill tone={riskTone(q.risk_level)}>
            RISK · {q.risk_level}
          </Pill>
        )}
        {q.model_used && (
          <span className="tick" style={{ marginLeft: 6 }}>
            {q.model_used}
          </span>
        )}
        {q.latency_ms && (
          <span
            className="mono"
            style={{ fontSize: 10.5, color: "var(--ink-4)" }}
          >
            {q.latency_ms}ms
          </span>
        )}
      </div>

      {/* The question itself — editorial headline */}
      <h1
        className="serif"
        style={{
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
          marginBottom: 22,
          color: "var(--ink)",
        }}
        data-testid="history-question-text"
      >
        {q.question_text}
      </h1>

      {/* Confidence meter (Sprint 4+ persistence) */}
      {(q.confidence_score !== null || q.consult_expert) && (
        <div style={{ marginBottom: 22 }}>
          <ConfidenceMeter
            score={q.confidence_score}
            consultExpert={q.consult_expert}
            data-testid="history-confidence"
          />
        </div>
      )}

      {/* Quick answer — editorial deck */}
      {q.quick_answer && (
        <div className="prose" style={{ marginBottom: 24 }}>
          <p className="dek" data-testid="history-quick-answer">
            {q.quick_answer}
          </p>
        </div>
      )}

      {/* Affected teams */}
      {q.affected_teams && q.affected_teams.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div className="tick" style={{ marginBottom: 6 }}>
            AFFECTED TEAMS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {q.affected_teams.map((team) => (
              <Pill key={team}>{team}</Pill>
            ))}
          </div>
        </div>
      )}

      {/* Full answer body — serif prose */}
      {q.answer_text && (
        <>
          <hr className="hr" style={{ margin: "12px 0 18px" }} />
          <div className="tick" style={{ marginBottom: 12 }}>
            ANSWER · CITED INTERPRETATION
          </div>
          <div
            className="prose"
            style={{ maxWidth: 720, marginBottom: 32 }}
            data-testid="history-answer-body"
          >
            <ReactMarkdown>{q.answer_text}</ReactMarkdown>
          </div>
        </>
      )}

      {/* Citations */}
      {q.citations && q.citations.length > 0 && (
        <div style={{ marginBottom: 32 }} data-testid="history-citations">
          <div className="tick" style={{ marginBottom: 10 }}>
            CITATIONS · {q.citations.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.citations.map((c, i) => (
              <div
                key={i}
                className="panel"
                style={{ padding: 12 }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-2)",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {c.circular_number}
                  {c.section_reference && (
                    <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>
                      {" · "}
                      {c.section_reference}
                    </span>
                  )}
                </div>
                <p
                  className="serif"
                  style={{
                    fontSize: 13.5,
                    fontStyle: "italic",
                    color: "var(--ink-2)",
                    lineHeight: 1.5,
                  }}
                >
                  &ldquo;{c.verbatim_quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {q.recommended_actions && q.recommended_actions.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="tick" style={{ marginBottom: 10 }}>
            RECOMMENDED ACTIONS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {q.recommended_actions.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 120px 1fr",
                  gap: 12,
                  padding: "10px 14px",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                  borderRadius: 3,
                  alignItems: "center",
                }}
              >
                <Pill tone={priorityTone(a.priority)}>{a.priority}</Pill>
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--ink-3)" }}
                >
                  {a.team}
                </span>
                <span style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                  {a.action_text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback + share */}
      <hr className="hr" style={{ margin: "12px 0 18px" }} />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div className="tick" style={{ marginBottom: 10 }}>
            FEEDBACK · WAS THIS HELPFUL?
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn
              variant={q.feedback === 1 ? "primary" : ""}
              disabled={q.feedback !== null}
              onClick={() =>
                feedbackMutation.mutate({ questionId: id, feedback: 1 })
              }
              data-testid="history-feedback-yes"
            >
              <Icon.Thumb /> Yes
            </Btn>
            <Btn
              variant={q.feedback === -1 ? "primary" : ""}
              disabled={q.feedback !== null}
              onClick={() =>
                feedbackMutation.mutate({ questionId: id, feedback: -1 })
              }
              data-testid="history-feedback-no"
            >
              <Icon.ThumbDown /> No
            </Btn>
          </div>
        </div>

        <Btn
          variant=""
          onClick={() => {
            trackEvent("share_snippet_dialog_opened", { question_id: id });
            setShareOpen(true);
          }}
          data-testid="history-share-button"
        >
          <Icon.Arrow /> Share snippet
        </Btn>
      </div>

      <ShareSnippetDialog
        questionId={id}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
