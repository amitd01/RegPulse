"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge, impactVariant } from "@/components/ui/Badge";
import { ConfidenceMeter } from "@/components/ui/ConfidenceMeter";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/stores/authStore";
import { trackEvent } from "@/lib/analytics";
import api from "@/lib/api";
import type { CitationItem, RecommendedAction } from "@/types";

interface Suggestion {
  id: string;
  question_text: string;
  quick_answer_preview: string | null;
}

interface StreamState {
  status: "idle" | "streaming" | "done" | "error";
  answer: string;
  quickAnswer: string | null;
  riskLevel: string | null;
  confidenceScore: number | null;
  consultExpert: boolean;
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
  confidenceScore: null,
  consultExpert: false,
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced suggestions lookup — fires 300 ms after the user stops typing.
  useEffect(() => {
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    const trimmed = question.trim();
    if (trimmed.length < 5) {
      setSuggestions([]);
      return;
    }
    suggestionTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/questions/suggestions", {
          params: { q: trimmed, limit: 5 },
        });
        setSuggestions(data.data || []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    };
  }, [question]);

  const suggestionList = useMemo(
    () => (showSuggestions ? suggestions : []),
    [showSuggestions, suggestions],
  );

  // ---------------------------------------------------------------------------
  // Streaming helpers
  //
  // WHY setInterval instead of requestAnimationFrame:
  //   reader.read() resolves as a microtask. When the server sends tokens fast
  //   (or TCP delivers a batch), dozens of microtasks can resolve before the
  //   browser reaches its next rendering phase. rAF callbacks only fire during
  //   that rendering phase, so they are starved — all tokens pile up and are
  //   flushed in one shot at the end. setInterval is a macrotask; it fires on
  //   a fixed wall-clock cadence (50 ms ≈ 20 fps) regardless of how many
  //   microtasks are queued, guaranteeing incremental React state updates
  //   throughout the stream.
  // ---------------------------------------------------------------------------
  const tokenBufferRef = useRef<string>("");
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (flushIntervalRef.current !== null) clearInterval(flushIntervalRef.current);
    };
  }, []);

  // Drain tokenBufferRef into React state immediately (used at event boundaries)
  const flushTokens = useCallback(() => {
    const pending = tokenBufferRef.current;
    if (!pending) return;
    tokenBufferRef.current = "";
    setState((prev) => ({ ...prev, answer: prev.answer + pending }));
  }, []);

  const stopFlushInterval = useCallback(() => {
    if (flushIntervalRef.current !== null) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
  }, []);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || question.trim().length < 5) return;
    if (state.status === "streaming") return;

    tokenBufferRef.current = "";
    stopFlushInterval();
    setState({ ...initialState, status: "streaming" });
    trackEvent("ask_question_submitted", {
      question_length: question.trim().length,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    // Start the interval before the fetch so the first token is always
    // flushed within 50 ms of arriving, even if the read loop runs fast.
    flushIntervalRef.current = setInterval(() => {
      const pending = tokenBufferRef.current;
      if (!pending) return;
      tokenBufferRef.current = "";
      setState((prev) => ({ ...prev, answer: prev.answer + pending }));
    }, 50);

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
        stopFlushInterval();
        const errorData = await response.json().catch(() => null);
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: errorData?.error || `Request failed (${response.status})`,
        }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        stopFlushInterval();
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: "No response body",
        }));
        return;
      }

      const decoder = new TextDecoder();
      // Carry-over buffer for partial SSE messages that span read() calls
      let partial = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Normalise both CRLF and bare CR to LF so the \n\n split is reliable
        partial += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n");

        // SSE messages are separated by blank lines (\n\n).  Split there so
        // each iteration processes one complete message at a time. The last
        // slice may be an incomplete message — keep it in `partial`.
        const messages = partial.split("\n\n");
        partial = messages.pop() ?? "";

        for (const message of messages) {
          if (!message.trim()) continue;

          // Extract the named event type and its data payload from the block.
          // The SSE spec puts "event:" before "data:" within the same message.
          let eventType = "";
          let dataStr = "";
          for (const line of message.split("\n")) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6);
            }
          }
          if (!dataStr) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue; // skip malformed JSON
          }

          switch (eventType) {
            case "token":
              // Accumulate in ref; the setInterval drains it to React state.
              tokenBufferRef.current += (data.token as string) ?? "";
              break;

            case "citations": {
              // Inline-flush so the prose panel is up-to-date before metadata
              // arrives — prevents citations appearing ahead of their context.
              const pending = tokenBufferRef.current;
              if (pending) {
                tokenBufferRef.current = "";
                setState((prev) => ({ ...prev, answer: prev.answer + pending }));
              }
              setState((prev) => ({
                ...prev,
                citations: (data.citations as CitationItem[]) || [],
                riskLevel: (data.risk_level as string) || null,
                confidenceScore:
                  typeof data.confidence_score === "number"
                    ? data.confidence_score
                    : null,
                consultExpert: Boolean(data.consult_expert),
                affectedTeams: (data.affected_teams as string[]) || [],
                recommendedActions:
                  (data.recommended_actions as RecommendedAction[]) || [],
                quickAnswer: (data.quick_answer as string) || null,
              }));
              trackEvent("confidence_meter_viewed", {
                confidence_score:
                  typeof data.confidence_score === "number"
                    ? data.confidence_score
                    : null,
                consult_expert: Boolean(data.consult_expert),
                source: "ask",
              });
              break;
            }

            case "done": {
              stopFlushInterval();
              // Merge any buffered tokens into the final state in one update
              // to avoid a transient render without the last few words.
              const pending = tokenBufferRef.current;
              tokenBufferRef.current = "";
              setState((prev) => ({
                ...prev,
                status: "done",
                answer: pending ? prev.answer + pending : prev.answer,
                questionId: (data.question_id as string) ?? null,
                creditBalance:
                  typeof data.credit_balance === "number"
                    ? data.credit_balance
                    : null,
              }));
              if (user && data.credit_balance !== undefined) {
                useAuthStore.setState({
                  user: {
                    ...user,
                    credit_balance: data.credit_balance as number,
                  },
                });
              }
              break;
            }

            case "error":
              // Ignore late error events that arrive AFTER event:done — the
              // answer was already rendered successfully and only the
              // background DB/cache work failed. The user should not see an
              // error banner when they received a complete answer.
              // Only show the error banner when the stream terminated before
              // the answer completed (status is still "streaming").
              stopFlushInterval();
              flushTokens();
              setState((prev) => {
                if (prev.status === "done") return prev; // swallow late error
                return {
                  ...prev,
                  status: "error",
                  errorMessage: (data.error as string) ?? "Streaming error",
                };
              });
              break;

            default:
              // Fallback shape-based dispatch for any future/undocumented events
              if (typeof data.token === "string") {
                tokenBufferRef.current += data.token;
              } else if (typeof data.error === "string") {
                stopFlushInterval();
                flushTokens();
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  errorMessage: data.error as string,
                }));
              }
          }
        }
      }

      // Stream closed without an explicit `done` event (edge case)
      stopFlushInterval();
      flushTokens();
      setState((prev) =>
        prev.status === "streaming" ? { ...prev, status: "done" } : prev,
      );
    } catch (err) {
      stopFlushInterval();
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Request failed",
      }));
    }
  }, [question, state.status, accessToken, user, flushTokens, stopFlushInterval]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAsk();
      }
    },
    [handleAsk],
  );

  // Show the answer panel during streaming, after completion, AND when an
  // error occurs mid-stream: partial answers are still valuable — the error
  // banner renders separately. Previously this hid the answer on error status,
  // discarding any text already flushed to state.
  const showAnswer = state.status !== "idle" && Boolean(state.answer);

  return (
    <div className="flex h-full flex-col px-6 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Ask RegPulse
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ask any RBI regulatory compliance question. Answers cite exact
          circulars.
        </p>
      </div>

      {/* Question input */}
      <div className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g., What are the latest KYC requirements for banks under SBR framework?"
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
            {suggestionList.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {suggestionList.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuestion(s.question_text);
                        setShowSuggestions(false);
                      }}
                      className="block w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="text-sm text-gray-800 dark:text-gray-100 line-clamp-1">
                        {s.question_text}
                      </div>
                      {s.quick_answer_preview && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {s.quick_answer_preview}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={handleAsk}
            disabled={
              state.status === "streaming" || question.trim().length < 5
            }
            className="rounded-lg bg-navy-700 px-6 py-3 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-navy-500 dark:hover:bg-navy-400"
          >
            {state.status === "streaming" ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              "Ask"
            )}
          </button>
        </div>
      </div>

      {/* Error banner — shown even when partial answer text is present */}
      {state.status === "error" && state.errorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.errorMessage}
        </div>
      )}

      {/* Answer */}
      {showAnswer && (
        <div className="flex-1 space-y-6 overflow-y-auto">
          {/* Confidence meter — stable container prevents layout shift when
              metadata arrives mid-stream after the prose has started. */}
          <div className="min-h-[1px]">
            {(state.confidenceScore !== null || state.consultExpert) && (
              <ConfidenceMeter
                score={state.confidenceScore}
                consultExpert={state.consultExpert}
              />
            )}
          </div>

          {/* Quick answer */}
          {state.quickAnswer && (
            <div className="rounded-lg border border-navy-100 bg-navy-50 p-4 dark:border-navy-800 dark:bg-navy-900/40">
              <h3 className="mb-1 text-xs font-semibold uppercase text-navy-600 dark:text-navy-300">
                Quick Answer
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-100">
                {state.quickAnswer}
              </p>
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
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{state.answer}</ReactMarkdown>
          </div>

          {/* Citations */}
          {state.citations.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                Citations
              </h3>
              <div className="space-y-2">
                {state.citations.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="text-xs font-semibold text-navy-600 dark:text-navy-300">
                      {c.circular_number}
                      {c.section_reference && ` — ${c.section_reference}`}
                    </div>
                    <p className="mt-1 text-xs italic text-gray-600 dark:text-gray-300">
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
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                Recommended Actions
              </h3>
              <div className="space-y-2">
                {state.recommendedActions.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <Badge variant={impactVariant(a.priority)}>
                      {a.priority}
                    </Badge>
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {a.team}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">
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
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
              <Spinner size="sm" />
              Generating answer...
            </div>
          )}

          {/* Done info */}
          {state.status === "done" && state.creditBalance !== null && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Credits remaining: {state.creditBalance}
            </div>
          )}
        </div>
      )}

      {/* Idle state */}
      {state.status === "idle" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <svg
            className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-700"
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
          <p className="text-gray-400 dark:text-gray-500">
            Type a question about RBI regulations to get started.
          </p>
        </div>
      )}
    </div>
  );
}
