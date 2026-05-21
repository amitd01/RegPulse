"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnswerView } from "@/components/answer/AnswerView";
import { AnnotationPanel } from "@/components/collaboration/AnnotationPanel";
import { ShareSnippetDialog } from "@/components/ShareSnippetDialog";
import { Spinner } from "@/components/ui/Spinner";
import { trackEvent } from "@/lib/analytics";
import { useQuestionDetail, useSubmitFeedback } from "@/hooks/useQuestions";

export default function QuestionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [shareOpen, setShareOpen] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const { data, isLoading, isError } = useQuestionDetail(id);
  const feedbackMutation = useSubmitFeedback();

  // Fire `confidence_meter_viewed` once per question load
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
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-6 py-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Question not found or failed to load.
        </div>
        <Link
          href="/history"
          className="mt-4 inline-block text-sm font-medium text-crimson-600"
        >
          ← Back to History
        </Link>
      </div>
    );
  }

  const q = data.data;

  const handleFeedback = ({
    comment,
    category,
    is_helpful,
  }: {
    comment: string;
    category: string;
    is_helpful: boolean;
  }) => {
    feedbackMutation.mutate(
      {
        questionId: id,
        is_helpful,
        category: category || undefined,
        comment: comment || undefined,
      },
      {
        onSuccess: () => setFeedbackSubmitted(true),
      },
    );
  };

  const shareButton = (
    <button
      onClick={() => {
        trackEvent("share_snippet_dialog_opened", { question_id: id });
        setShareOpen(true);
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      Share
    </button>
  );

  return (
    <div className="min-h-full bg-gray-50 px-6 py-6 lg:px-10">
      {/* Back link */}
      <Link
        href="/history"
        className="mb-5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to History
      </Link>

      {/* Shared answer view */}
      <AnswerView
        question={q.question_text}
        quickAnswer={q.quick_answer}
        answer={q.answer_text ?? ""}
        riskLevel={q.risk_level}
        confidenceScore={q.confidence_score}
        consultExpert={q.consult_expert}
        citations={q.citations ?? []}
        affectedTeams={q.affected_teams ?? []}
        recommendedActions={q.recommended_actions ?? []}
        isStreaming={false}
        questionId={q.id}
        modelUsed={q.model_used}
        createdAt={q.created_at}
        latencyMs={q.latency_ms}
        onFeedback={handleFeedback}
        isFeedbackSubmitting={feedbackMutation.isPending}
        feedbackSubmitted={feedbackSubmitted}
        existingFeedback={q.feedback_record}
        extraActions={shareButton}
      />

      {q.answer_text && (
        <div className="mx-auto mt-8 max-w-5xl">
          <h2 className="mb-4 font-serif text-xl text-[#1A2B40] dark:text-gray-100">
            Team Annotations
          </h2>
          <AnnotationPanel questionId={q.id} answerText={q.answer_text} />
        </div>
      )}

      <ShareSnippetDialog
        questionId={id}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
