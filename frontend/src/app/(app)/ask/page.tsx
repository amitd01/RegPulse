"use client";

import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge, impactVariant } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/stores/authStore";
import type { CitationItem, RecommendedAction } from "@/types";

interface StreamState {
  status: "idle" | "streaming" | "done" | "error";
  answer: string;
  quickAnswer: string | null;
  riskLevel: string | null;
  citations: CitationItem[];
  affectedTeams: string[];
  recommendedActions: RecommendedAction[];
  questionId: string | null;
  creditBalance: number | null;
  errorMessage: string | null;
}

const initialState: StreamState = {
  status: "idle",
  answer: "",
  quickAnswer: null,
  riskLevel: null,
  citations: [],
  affectedTeams: [],
  recommendedActions: [],
  questionId: null,
  creditBalance: null,
  errorMessage: null,
};

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<StreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || question.trim().length < 5) return;
    if (state.status === "streaming") return;

    setState({ ...initialState, status: "streaming" });

    const controller = new AbortController();
    abortRef.current = controller;

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

    try {
      const response = await fetch(`${apiUrl}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ question: question.trim() }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage:
            errorData?.error || `Request failed (${response.status})`,
        }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: "No response body",
        }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            // Event type parsed from SSE protocol (data follows on next line)
            continue;
          }
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              // Determine event type from the data shape
              if ("token" in data) {
                setState((prev) => ({
                  ...prev,
                  answer: prev.answer + data.token,
                }));
              } else if ("citations" in data) {
                setState((prev) => ({
                  ...prev,
                  citations: data.citations || [],
                  riskLevel: data.risk_level || null,
                  affectedTeams: data.affected_teams || [],
                  recommendedActions: data.recommended_actions || [],
                  quickAnswer: data.quick_answer || null,
                }));
              } else if ("question_id" in data) {
                setState((prev) => ({
                  ...prev,
                  status: "done",
                  questionId: data.question_id,
                  creditBalance: data.credit_balance,
                }));
                // Update credit balance in store
                if (user && data.credit_balance !== undefined) {
                  useAuthStore.setState({
                    user: { ...user, credit_balance: data.credit_balance },
                  });
                }
              } else if ("error" in data) {
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  errorMessage: data.error,
                }));
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      // If we reach here without "done", mark as done
      setState((prev) =>
        prev.status === "streaming" ? { ...prev, status: "done" } : prev,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Request failed",
      }));
    }
  }, [question, state.status, accessToken, user]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAsk();
      }
    },
    [handleAsk],
  );

  return (
    <div className="flex h-full flex-col px-6 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ask RegPulse</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ask any RBI regulatory compliance question. Answers cite exact
          circulars.
        </p>
      </div>

      {/* Question input */}
      <div className="mb-6 flex gap-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., What are the latest KYC requirements for banks under SBR framework?"
          rows={2}
          maxLength={500}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
        />
        <button
          onClick={handleAsk}
          disabled={
            state.status === "streaming" || question.trim().length < 5
          }
          className="rounded-lg bg-navy-700 px-6 py-3 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.status === "streaming" ? (
            <Spinner size="sm" className="text-white" />
          ) : (
            "Ask"
          )}
        </button>
      </div>

      {/* Error */}
      {state.status === "error" && state.errorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.errorMessage}
        </div>
      )}

      {/* Answer */}
      {(state.status === "streaming" || state.status === "done") &&
        state.answer && (
          <div className="flex-1 space-y-6 overflow-y-auto">
            {/* Quick answer */}
            {state.quickAnswer && (
              <div className="rounded-lg border border-navy-100 bg-navy-50 p-4">
                <h3 className="mb-1 text-xs font-semibold uppercase text-navy-600">
                  Quick Answer
                </h3>
                <p className="text-sm text-gray-800">{state.quickAnswer}</p>
              </div>
            )}

            {/* Risk level + affected teams */}
            {(state.riskLevel || state.affectedTeams.length > 0) && (
              <div className="flex flex-wrap items-center gap-3">
                {state.riskLevel && (
                  <Badge variant={impactVariant(state.riskLevel)}>
                    Risk: {state.riskLevel}
                  </Badge>
                )}
                {state.affectedTeams.map((team) => (
                  <Badge key={team}>{team}</Badge>
                ))}
              </div>
            )}

            {/* Full answer */}
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{state.answer}</ReactMarkdown>
            </div>

            {/* Citations */}
            {state.citations.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Citations
                </h3>
                <div className="space-y-2">
                  {state.citations.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="text-xs font-semibold text-navy-600">
                        {c.circular_number}
                        {c.section_reference && ` — ${c.section_reference}`}
                      </div>
                      <p className="mt-1 text-xs italic text-gray-600">
                        &ldquo;{c.verbatim_quote}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended actions */}
            {state.recommendedActions.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Recommended Actions
                </h3>
                <div className="space-y-2">
                  {state.recommendedActions.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <Badge variant={impactVariant(a.priority)}>
                        {a.priority}
                      </Badge>
                      <div>
                        <div className="text-xs font-medium text-gray-500">
                          {a.team}
                        </div>
                        <div className="text-sm text-gray-700">
                          {a.action_text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Streaming indicator */}
            {state.status === "streaming" && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Spinner size="sm" />
                Generating answer...
              </div>
            )}

            {/* Done info */}
            {state.status === "done" && state.creditBalance !== null && (
              <div className="text-xs text-gray-400">
                Credits remaining: {state.creditBalance}
              </div>
            )}
          </div>
        )}

      {/* Idle state */}
      {state.status === "idle" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <svg
            className="mb-4 h-16 w-16 text-gray-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
          <p className="text-gray-400">
            Type a question about RBI regulations to get started.
          </p>
        </div>
      )}
    </div>
  );
}
