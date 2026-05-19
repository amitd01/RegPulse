"use client";

import ReactMarkdown from "react-markdown";
import { CitationCard } from "./CitationCard";
import { FeedbackSection } from "./FeedbackSection";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { Spinner } from "@/components/ui/Spinner";
import type { CitationItem, RecommendedAction } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnswerViewProps {
  question?: string;

  // Answer content
  quickAnswer: string | null;
  answer: string;
  riskLevel: string | null;
  confidenceScore: number | null;
  consultExpert: boolean;
  citations: CitationItem[];
  affectedTeams: string[];
  recommendedActions: RecommendedAction[];

  // State
  isStreaming?: boolean;

  // Optional metadata
  questionId?: string | null;
  creditBalance?: number | null;
  modelUsed?: string | null;
  createdAt?: string | null;
  latencyMs?: number | null;

  // Callbacks
  onFeedback?: (data: { comment: string; category: string; feedback: number }) => void;
  isFeedbackSubmitting?: boolean;
  feedbackSubmitted?: boolean;
  existingFeedback?: number | null;

  // Optional extra actions slot (e.g. Share button in history)
  extraActions?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk badge helper
// ─────────────────────────────────────────────────────────────────────────────

function riskStyle(level: string | null) {
  switch (level?.toUpperCase()) {
    case "HIGH":
      return "bg-red-100 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "LOW":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Team icon helper
// ─────────────────────────────────────────────────────────────────────────────

function TeamIcon({ team }: { team: string }) {
  const t = team.toLowerCase();
  if (t.includes("risk"))
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  if (t.includes("compliance"))
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
  if (t.includes("operations") || t.includes("ops"))
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        {icon && <div className="text-crimson-600">{icon}</div>}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming skeleton
// ─────────────────────────────────────────────────────────────────────────────

function StreamingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[100, 90, 75, 85, 60].map((w, i) => (
        <div key={i} className={`h-3 rounded bg-gray-200`} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AnswerView
// ─────────────────────────────────────────────────────────────────────────────

export function AnswerView({
  question,
  quickAnswer,
  answer,
  riskLevel,
  confidenceScore,
  consultExpert,
  citations,
  affectedTeams,
  recommendedActions,
  isStreaming = false,
  questionId: _questionId,
  creditBalance,
  modelUsed,
  createdAt,
  latencyMs,
  onFeedback,
  isFeedbackSubmitting,
  feedbackSubmitted,
  existingFeedback,
  extraActions,
}: AnswerViewProps) {
  // Group recommended actions by team
  const actionsByTeam = recommendedActions.reduce<Record<string, RecommendedAction[]>>(
    (acc, action) => {
      const key = action.team || "General";
      if (!acc[key]) acc[key] = [];
      acc[key].push(action);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="rounded-xl border border-crimson-100 bg-gradient-to-r from-crimson-700 to-crimson-900 px-6 py-5 text-white shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <svg className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
            Interpretation Results
          </span>
        </div>
        <p className="text-sm opacity-70">AI-generated guidance with full source citations</p>

        {/* Question echo */}
        {question && (
          <div className="mt-3 rounded-lg bg-white/10 px-4 py-2.5 backdrop-blur-sm">
            <span className="text-xs font-medium opacity-70">Your Question:</span>
            <p className="mt-0.5 text-sm italic">&ldquo;{question}&rdquo;</p>
          </div>
        )}

        {/* Metadata row */}
        {(createdAt || modelUsed || latencyMs) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs opacity-60">
            {createdAt && (
              <span>
                {new Date(createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {modelUsed && <span>{modelUsed}</span>}
            {latencyMs && <span>{latencyMs}ms</span>}
          </div>
        )}
      </div>

      {/* ── Confidence meter ─────────────────────────────────── */}
      {(confidenceScore !== null || consultExpert) && (
        <ConfidenceMeter score={confidenceScore} consultExpert={consultExpert} />
      )}

      {/* ── Quick Answer ─────────────────────────────────────── */}
      {quickAnswer && (
        <div className="rounded-xl border border-crimson-100 bg-gradient-to-r from-crimson-700 to-crimson-900 px-6 py-5 text-white shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-4 w-4 text-crimson-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-xs font-bold uppercase tracking-widest text-crimson-300">
              Quick Answer
            </h3>
          </div>
          <p className="text-sm leading-relaxed">{quickAnswer}</p>

          {/* Risk + Teams row */}
          {(riskLevel || affectedTeams.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {riskLevel && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${riskStyle(riskLevel)}`}
                >
                  Risk Level: {riskLevel}
                </span>
              )}
              {affectedTeams.map((team) => (
                <span
                  key={team}
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white"
                >
                  {team}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detailed Interpretation ──────────────────────────── */}
      {(answer || isStreaming) && (
        <Section
          title="Detailed Interpretation"
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        >
          {answer ? (
            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 prose-a:text-crimson-600 prose-a:no-underline hover:prose-a:underline dark:prose-invert">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          ) : (
            <StreamingSkeleton />
          )}
          {isStreaming && (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <Spinner size="sm" />
              <span>Generating detailed interpretation…</span>
            </div>
          )}
        </Section>
      )}

      {/* ── Source Citations ─────────────────────────────────── */}
      {citations.length > 0 && (
        <Section
          title={`Source Citations (${citations.length})`}
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        >
          <div className="space-y-2">
            {citations.map((c, i) => (
              <CitationCard key={i} citation={c} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* No citations fallback */}
      {!isStreaming && citations.length === 0 && answer && !consultExpert && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="text-xs font-semibold text-amber-800">No Direct Citations Found</div>
              <div className="mt-0.5 text-xs text-amber-700">
                Direct interpretation not found in the provided circulars. The guidance above is a best-effort response — please validate with your Chief Compliance Officer.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recommended Actions by Team ──────────────────────── */}
      {Object.keys(actionsByTeam).length > 0 && (
        <Section
          title="Recommended Actions by Team"
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        >
          <div className="space-y-5">
            {Object.entries(actionsByTeam).map(([team, actions]) => (
              <div key={team}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-crimson-100 text-crimson-600">
                    <TeamIcon team={team} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{team}</span>
                </div>
                <div className="space-y-1.5 pl-8">
                  {actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div
                        className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          action.priority === "HIGH"
                            ? "bg-red-100 text-red-600"
                            : action.priority === "MEDIUM"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-emerald-100 text-emerald-600"
                        }`}
                      >
                        {action.priority[0]}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{action.action_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Action buttons ───────────────────────────────────── */}
      {!isStreaming && answer && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-crimson-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-crimson-800 transition-all active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Save to Library
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-crimson-300 bg-white px-5 py-2.5 text-sm font-semibold text-crimson-700 shadow-sm hover:bg-crimson-50 hover:border-crimson-500 transition-all active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Share with Team
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-crimson-300 bg-white px-5 py-2.5 text-sm font-semibold text-crimson-700 shadow-sm hover:bg-crimson-50 hover:border-crimson-500 transition-all active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Flag for Review
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-crimson-300 bg-white px-5 py-2.5 text-sm font-semibold text-crimson-700 shadow-sm hover:bg-crimson-50 hover:border-crimson-500 transition-all active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Get Clarification
          </button>
        </div>
      )}

      {/* ── Footer meta + extra actions ─────────────────────── */}
      {(creditBalance !== null && creditBalance !== undefined) ||
      extraActions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
          {creditBalance !== null && creditBalance !== undefined && (
            <span className="text-xs text-gray-400">
              Credits remaining:{" "}
              <span className="font-semibold text-gray-600">{creditBalance}</span>
            </span>
          )}
          {extraActions && <div className="flex flex-wrap gap-2">{extraActions}</div>}
        </div>
      ) : null}

      {/* ── Feedback ─────────────────────────────────────────── */}
      {onFeedback && (
        <FeedbackSection
          onSubmit={onFeedback}
          isSubmitting={isFeedbackSubmitting}
          submitted={feedbackSubmitted}
          existingFeedback={existingFeedback}
        />
      )}
    </div>
  );
}
