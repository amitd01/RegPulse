"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CitationCard } from "./CitationCard";
import { FeedbackSection } from "./FeedbackSection";
import { SaveToTeamLearningDialog } from "@/components/collaboration/SaveToTeamLearningDialog";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { Spinner } from "@/components/ui/Spinner";
import {
  getActionItemErrorMessage,
  useShareWithTeam,
} from "@/hooks/useActionItems";
import { getSaveErrorMessage, useIsQuestionSaved, useSaveInterpretation } from "@/hooks/useSavedInterpretations";
import type { CitationItem, FeedbackRecord, RecommendedAction } from "@/types";

function buildSaveName(question?: string, quickAnswer?: string | null): string {
  const source = question?.trim() || quickAnswer?.trim() || "Saved interpretation";
  return source.length > 255 ? `${source.slice(0, 252)}...` : source;
}

export interface AnswerViewProps {
  question?: string;
  quickAnswer: string | null;
  answer: string;
  riskLevel: string | null;
  confidenceScore: number | null;
  consultExpert: boolean;
  citations: CitationItem[];
  affectedTeams: string[];
  recommendedActions: RecommendedAction[];
  isStreaming?: boolean;
  questionId?: string | null;
  creditBalance?: number | null;
  modelUsed?: string | null;
  createdAt?: string | null;
  latencyMs?: number | null;
  onFeedback?: (data: { comment: string; category: string; is_helpful: boolean }) => void;
  isFeedbackSubmitting?: boolean;
  feedbackSubmitted?: boolean;
  existingFeedback?: FeedbackRecord | null;
  extraActions?: React.ReactNode;
  /** Primary = first turn (full header); followup = compact thread turn */
  variant?: "primary" | "followup";
}

function riskStyle(level: string | null) {
  switch (level?.toUpperCase()) {
    case "HIGH":
      return "bg-red-50 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "LOW":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-cream-200 text-[#4D6480] border-cream-300";
  }
}

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

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-cream-300 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-cream-200 px-5 py-4">
        {icon && <div className="text-gold-500">{icon}</div>}
        <h3 className="text-[13.5px] font-semibold text-[#1A2B40]">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function StreamingSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[100, 90, 75, 85, 60].map((w, i) => (
        <div key={i} className="h-3 rounded bg-cream-200" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

const NAVY_CARD = "rounded-xl px-6 py-5 text-white shadow-[0_4px_20px_rgba(15,28,46,0.15)]";
const NAVY_GRADIENT = { background: "linear-gradient(135deg, #1E3050, #162236)" };

const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]";
const btnSecondary =
  "inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-5 py-2.5 text-[13px] font-medium text-[#4D6480] shadow-sm transition-all hover:border-gold-500 hover:text-[#1A2B40] active:scale-[0.98]";

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
  questionId,
  creditBalance,
  modelUsed,
  createdAt,
  latencyMs,
  onFeedback,
  isFeedbackSubmitting,
  feedbackSubmitted,
  existingFeedback,
  extraActions,
  variant = "primary",
}: AnswerViewProps) {
  const isFollowup = variant === "followup";
  const saveMutation = useSaveInterpretation();
  const shareMutation = useShareWithTeam();
  const alreadySaved = useIsQuestionSaved(questionId);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const isSaved = saveSuccess || alreadySaved;

  useEffect(() => {
    setSaveSuccess(false);
    setSaveError(null);
    setShareSuccess(null);
    setShareError(null);
  }, [questionId]);

  const handleSaveToLibrary = useCallback(() => {
    if (!questionId || isStreaming || saveMutation.isPending || isSaved) return;

    setSaveError(null);
    const name = buildSaveName(question, quickAnswer);
    const tags = affectedTeams.length > 0 ? affectedTeams : undefined;

    saveMutation.mutate(
      { question_id: questionId, name, tags },
      {
        onSuccess: () => setSaveSuccess(true),
        onError: (err) => setSaveError(getSaveErrorMessage(err)),
      },
    );
  }, [
    questionId,
    isStreaming,
    saveMutation,
    isSaved,
    question,
    quickAnswer,
    affectedTeams,
  ]);

  const handleShareWithTeam = useCallback(() => {
    if (!questionId || isStreaming || shareMutation.isPending || shareSuccess) return;

    setShareError(null);
    shareMutation.mutate(
      {
        questionId,
        question,
        quickAnswer,
        recommendedActions,
      },
      {
        onSuccess: (result) => {
          const label =
            result.created === 1 ? "1 action item" : `${result.created} action items`;
          setShareSuccess(
            `Shared with your team — ${label} created. View them under Action Items.`,
          );
        },
        onError: (err) => setShareError(getActionItemErrorMessage(err)),
      },
    );
  }, [
    questionId,
    isStreaming,
    shareMutation,
    shareSuccess,
    question,
    quickAnswer,
    recommendedActions,
  ]);
  const [learningDialogOpen, setLearningDialogOpen] = useState(false);

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
    <div className="mx-auto max-w-3xl space-y-5">
      {isFollowup && question && (
        <div className="flex justify-end">
          <div className="max-w-[92%] rounded-2xl rounded-br-md border border-cream-300 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A95AD]">
              You asked
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-[#1A2B40]">{question}</p>
          </div>
        </div>
      )}

      {/* Interpretation results header — primary turn only */}
      {!isFollowup && (
        <div className={NAVY_CARD} style={NAVY_GRADIENT}>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(201,151,46,0.15)]">
              <svg className="h-4 w-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D0DFF0]">
              Interpretation Results
            </span>
          </div>
          <p className="text-[12px] text-[#7A95AD]">AI-generated guidance with full source citations</p>

          {question && (
            <div className="mt-3 rounded-lg border border-[#253B57] bg-[rgba(255,255,255,0.06)] px-4 py-2.5">
              <span className="text-[11px] font-medium text-[#7A95AD]">Your Question:</span>
              <p className="mt-0.5 text-[13px] italic text-[#C8D8E8]">&ldquo;{question}&rdquo;</p>
            </div>
          )}

          {(createdAt || modelUsed || latencyMs) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#7A95AD]">
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
      )}

      {isFollowup && !isStreaming && (answer || quickAnswer) && (
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A95AD]">
          <span className="h-px flex-1 bg-cream-300" />
          <span className="text-gold-600">RegPulse</span>
          <span className="h-px flex-1 bg-cream-300" />
        </div>
      )}

      {/* Confidence meter */}
      {(confidenceScore !== null || consultExpert) && (
        <ConfidenceMeter score={confidenceScore} consultExpert={consultExpert} />
      )}

      {/* Quick Answer */}
      {quickAnswer && (
        <div className={NAVY_CARD} style={NAVY_GRADIENT}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(201,151,46,0.2)]">
              <svg className="h-3.5 w-3.5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-400">
              Quick Answer
            </h3>
          </div>
          <p className="text-[13.5px] leading-relaxed text-[#C8D8E8]">{quickAnswer}</p>

          {(riskLevel || affectedTeams.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {riskLevel && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${riskStyle(riskLevel)}`}
                >
                  Risk Level: {riskLevel}
                </span>
              )}
              {affectedTeams.map((team) => (
                <span
                  key={team}
                  className="inline-flex items-center rounded-full border border-[#253B57] bg-[rgba(255,255,255,0.08)] px-2.5 py-0.5 text-[11px] font-medium text-[#C8D8E8]"
                >
                  {team}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detailed Interpretation */}
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
            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-[#1A2B40] prose-p:text-[#4D6480] prose-li:text-[#4D6480] prose-strong:text-[#1A2B40] prose-a:text-gold-600 prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          ) : (
            <StreamingSkeleton />
          )}
          {isStreaming && !answer.trim() && (
            <div className="mt-4 flex items-center gap-2 text-[12px] text-[#7A95AD]">
              <Spinner size="sm" />
              <span>Generating detailed interpretation…</span>
            </div>
          )}
        </Section>
      )}

      {/* Source Citations */}
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

      {!isStreaming && citations.length === 0 && answer && !consultExpert && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="text-[12px] font-semibold text-amber-800">No Direct Citations Found</div>
              <div className="mt-0.5 text-[12px] text-amber-700">
                Direct interpretation not found in the provided circulars. The guidance above is a best-effort response — please validate with your Chief Compliance Officer.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommended Actions */}
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
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1B3A5C12] text-gold-600">
                    <TeamIcon team={team} />
                  </div>
                  <span className="text-[12px] font-semibold text-[#4D6480]">{team}</span>
                </div>
                <div className="space-y-1.5 pl-8">
                  {actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          action.priority === "HIGH"
                            ? "bg-red-100 text-red-600"
                            : action.priority === "MEDIUM"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-emerald-100 text-emerald-600"
                        }`}
                      >
                        {action.priority[0]}
                      </div>
                      <p className="text-[13px] leading-relaxed text-[#4D6480]">{action.action_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Action buttons */}
      {!isStreaming && answer && (
        <div className="space-y-3">
          {isSaved && (
            <div
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              role="status"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {alreadySaved && !saveSuccess
                  ? "Already saved to your library. View it anytime under Saved Interpretations."
                  : "Saved to your library. View it anytime under Saved Interpretations."}
              </span>
            </div>
          )}
          {saveError && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              <span className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {saveError}
              </span>
            </div>
          )}
          {shareSuccess && (
            <div
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              role="status"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {shareSuccess}
              </span>
            </div>
          )}
          {shareError && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              <span className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {shareError}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btnPrimary}
            onClick={handleSaveToLibrary}
            disabled={!questionId || saveMutation.isPending || isSaved}
          >
            {saveMutation.isPending ? (
              <>
                <Spinner size="sm" />
                Saving…
              </>
            ) : isSaved ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {alreadySaved && !saveSuccess ? "Already Saved" : "Saved"}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Save to Library
              </>
            )}
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={handleShareWithTeam}
            disabled={!questionId || shareMutation.isPending || !!shareSuccess}
          >
            {shareMutation.isPending ? (
              <>
                <Spinner size="sm" />
                Sharing…
              </>
            ) : shareSuccess ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Shared
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Share with Team
              </>
            )}
          </button>
          {questionId && (
            <button
              type="button"
              onClick={() => setLearningDialogOpen(true)}
              className={btnSecondary}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Save to Team Learnings
            </button>
          )}
          </div>
        </div>
      )}

      {/* Footer meta */}
      {(creditBalance !== null && creditBalance !== undefined) || extraActions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream-300 bg-white px-5 py-3 shadow-sm">
          {creditBalance !== null && creditBalance !== undefined && (
            <span className="text-[12px] text-[#7A95AD]">
              Credits remaining:{" "}
              <span className="font-semibold text-[#1A2B40]">{creditBalance}</span>
            </span>
          )}
          {extraActions && <div className="flex flex-wrap gap-2">{extraActions}</div>}
        </div>
      ) : null}

      {onFeedback && (
        <FeedbackSection
          onSubmit={onFeedback}
          isSubmitting={isFeedbackSubmitting}
          submitted={feedbackSubmitted}
          existingFeedback={existingFeedback}
        />
      )}

      {questionId && (
        <SaveToTeamLearningDialog
          open={learningDialogOpen}
          onClose={() => setLearningDialogOpen(false)}
          questionId={questionId}
          defaultTitle={question ? question.slice(0, 120) : "Insight from Q&A"}
          defaultNote={quickAnswer ?? answer.slice(0, 2000)}
        />
      )}
    </div>
  );
}
