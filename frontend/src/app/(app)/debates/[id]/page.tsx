"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import {
  useDebateDetail,
  usePostDebateReply,
  useResolveDebate,
} from "@/hooks/useCollaboration";
import { useAuthStore } from "@/stores/authStore";

export default function DebateDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError } = useDebateDetail(id);
  const postReply = usePostDebateReply(id);
  const resolveDebate = useResolveDebate(id);

  const [content, setContent] = useState("");
  const [stance, setStance] = useState<"AGREE" | "DISAGREE">("AGREE");
  const [decision, setDecision] = useState("");
  const [showResolve, setShowResolve] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-red-600">Debate not found.</p>
        <Link href="/debates" className="mt-4 inline-block text-sm text-crimson-600">
          ← Back to Debates
        </Link>
      </div>
    );
  }

  const debate = data.data;
  const isResolved = debate.status === "RESOLVED";
  const canResolve =
    !!user && !isResolved && (debate.user_id === user.id || user.is_admin);

  const handleReply = () => {
    if (!content.trim() || isResolved) return;
    postReply.mutate(
      { content: content.trim(), stance },
      { onSuccess: () => setContent("") },
    );
  };

  const handleResolve = () => {
    if (!decision.trim()) return;
    resolveDebate.mutate(decision.trim(), {
      onSuccess: () => {
        setDecision("");
        setShowResolve(false);
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <Link
          href="/debates"
          className="mb-5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Debates
        </Link>

        <div className="mb-6 rounded-xl border border-cream-300 bg-white p-6 dark:border-navy-700 dark:bg-navy-800">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                isResolved ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
              }`}
            >
              {debate.status}
            </span>
            <h1 className="font-serif text-2xl text-[#1A2B40] dark:text-white">{debate.title}</h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {debate.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
            {debate.creator && <span>Started by {debate.creator.full_name}</span>}
            <span>{debate.agree_count} agree · {debate.disagree_count} disagree</span>
          </div>

          {isResolved && debate.final_decision && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <div className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                Final Decision
              </div>
              <p className="mt-1 text-sm text-green-800 dark:text-green-200">{debate.final_decision}</p>
            </div>
          )}

          {canResolve && (
            <div className="mt-5">
              {!showResolve ? (
                <button
                  type="button"
                  onClick={() => setShowResolve(true)}
                  className="rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  Resolve Debate
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    placeholder="Record the official team decision…"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={resolveDebate.isPending}
                      onClick={handleResolve}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Confirm Resolution
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResolve(false)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Replies ({debate.replies.length})
        </h2>

        <div className="space-y-3">
          {debate.replies.map((reply) => (
            <div
              key={reply.id}
              className={`rounded-xl border bg-white p-4 dark:bg-navy-800 ${
                reply.stance === "AGREE"
                  ? "border-l-4 border-l-green-500 border-cream-300 dark:border-navy-700"
                  : "border-l-4 border-l-red-400 border-cream-300 dark:border-navy-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#1A2B40] dark:text-white">
                  {reply.author?.full_name ?? "Team member"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    reply.stance === "AGREE"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {reply.stance}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{reply.content}</p>
              <div className="mt-2 text-xs text-gray-400">
                {new Date(reply.created_at).toLocaleString("en-IN")}
              </div>
            </div>
          ))}
        </div>

        {!isResolved && (
          <div className="mt-6 rounded-xl border border-cream-300 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
            <h3 className="mb-3 text-sm font-semibold text-[#1A2B40] dark:text-white">Add Reply</h3>
            <div className="mb-3 flex gap-2">
              {(["AGREE", "DISAGREE"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStance(s)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    stance === s
                      ? s === "AGREE"
                        ? "bg-green-600 text-white"
                        : "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your perspective…"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            />
            <button
              type="button"
              disabled={postReply.isPending}
              onClick={handleReply}
              className="mt-3 rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {postReply.isPending ? "Posting…" : "Post Reply"}
            </button>
          </div>
        )}

        {isResolved && (
          <p className="mt-6 text-center text-sm text-gray-400">
            This debate is resolved — no further replies allowed.
          </p>
        )}
      </div>
    </div>
  );
}
