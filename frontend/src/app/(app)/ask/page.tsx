"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerView } from "@/components/answer/AnswerView";
import { useAuthStore } from "@/stores/authStore";
import { trackEvent } from "@/lib/analytics";
import api from "@/lib/api";
import type { CitationItem, RecommendedAction } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Suggested question card
// ─────────────────────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "What are the revised limits for pre-paid payment instruments under the latest RBI circular?",
  "How do the new STR reporting requirements apply to NBFCs?",
  "What are the data localisation requirements for storing customer information?",
  "What are the compliance requirements for launching a digital lending product?",
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<StreamState>(initialState);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  // Debounced suggestions lookup
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

  // ── Streaming helpers ──────────────────────────────────────────────────────
  //
  // WHY setInterval instead of requestAnimationFrame:
  //   reader.read() resolves as a microtask. setInterval fires on a fixed
  //   wall-clock cadence (50 ms ≈ 20 fps) regardless of queued microtasks,
  //   guaranteeing incremental React state updates throughout the stream.
  //
  const tokenBufferRef = useRef<string>("");
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (flushIntervalRef.current !== null) clearInterval(flushIntervalRef.current);
    };
  }, []);

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
    setFeedbackSubmitted(false);
    trackEvent("ask_question_submitted", { question_length: question.trim().length });

    // Scroll to answer area after a short delay
    setTimeout(() => answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    const controller = new AbortController();
    abortRef.current = controller;

    flushIntervalRef.current = setInterval(() => {
      const pending = tokenBufferRef.current;
      if (!pending) return;
      tokenBufferRef.current = "";
      setState((prev) => ({ ...prev, answer: prev.answer + pending }));
    }, 50);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
        setState((prev) => ({ ...prev, status: "error", errorMessage: "No response body" }));
        return;
      }

      const decoder = new TextDecoder();
      let partial = "";
      const streamStarted = true;

      const extractDetailedAnswer = (fullText: string): string => {
        try {
          const parsed = JSON.parse(fullText) as Record<string, unknown>;
          if (typeof parsed?.detailed_interpretation === "string") {
            return parsed.detailed_interpretation;
          }
        } catch {
          // plain text or partial JSON
        }
        return fullText;
      };

      const applySseEvent = (eventType: string, data: Record<string, unknown>) => {
        switch (eventType) {
          case "token":
            tokenBufferRef.current += (data.token as string) ?? "";
            break;

          case "citations": {
            stopFlushInterval();
            const pending = tokenBufferRef.current;
            tokenBufferRef.current = "";
            setState((prev) => {
              const fullText = prev.answer + (pending || "");
              return {
                ...prev,
                answer: extractDetailedAnswer(fullText),
                citations: (data.citations as CitationItem[]) || [],
                riskLevel: (data.risk_level as string) || null,
                confidenceScore:
                  typeof data.confidence_score === "number" ? data.confidence_score : null,
                consultExpert: Boolean(data.consult_expert),
                affectedTeams: (data.affected_teams as string[]) || [],
                recommendedActions: (data.recommended_actions as RecommendedAction[]) || [],
                quickAnswer: (data.quick_answer as string) || null,
              };
            });
            trackEvent("confidence_meter_viewed", {
              confidence_score:
                typeof data.confidence_score === "number" ? data.confidence_score : null,
              consult_expert: Boolean(data.consult_expert),
              source: "ask",
            });
            break;
          }

          case "done": {
            stopFlushInterval();
            const pending = tokenBufferRef.current;
            tokenBufferRef.current = "";
            setState((prev) => {
              const fullText = pending ? prev.answer + pending : prev.answer;
              return {
                ...prev,
                status: "done",
                answer: extractDetailedAnswer(fullText),
                questionId: (data.question_id as string) ?? null,
                creditBalance:
                  typeof data.credit_balance === "number" ? data.credit_balance : null,
              };
            });
            if (user && data.credit_balance !== undefined) {
              useAuthStore.setState({
                user: { ...user, credit_balance: data.credit_balance as number },
              });
            }
            break;
          }

          case "error":
            stopFlushInterval();
            flushTokens();
            setState((prev) => {
              if (prev.status === "done") return prev;
              return {
                ...prev,
                status: "error",
                errorMessage: (data.error as string) ?? "Streaming error",
              };
            });
            break;

          default:
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
      };

      const processSseBuffer = (buffer: string) => {
        const messages = buffer.split("\n\n");
        const remainder = messages.pop() ?? "";

        for (const message of messages) {
          if (!message.trim()) continue;

          let eventType = "";
          const dataLines: string[] = [];
          for (const line of message.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
          }
          const dataStr = dataLines.join("\n");
          if (!dataStr) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          applySseEvent(eventType, data);
        }

        return remainder;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (value) {
            partial += decoder
              .decode(value, { stream: true })
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n");
            partial = processSseBuffer(partial);
          }

          if (done) {
            // Flush the final SSE frame (e.g. event: done) left in partial
            if (partial.trim()) {
              processSseBuffer(`${partial}\n\n`);
            }
            break;
          }
        }
      } finally {
        if (streamStarted) {
          stopFlushInterval();
          flushTokens();
          setState((prev) =>
            prev.status === "streaming" ? { ...prev, status: "done" } : prev,
          );
        }
      }
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

  const handleFeedback = useCallback(
    async ({ comment, category, is_helpful }: { comment: string; category: string; is_helpful: boolean }) => {
      if (!state.questionId) return;
      setIsFeedbackSubmitting(true);
      try {
        await api.patch(`/questions/${state.questionId}/feedback`, {
          is_helpful,
          category: category || null,
          comment: comment || null,
        });
        setFeedbackSubmitted(true);
      } catch {
        // silent fail
      } finally {
        setIsFeedbackSubmitting(false);
      }
    },
    [state.questionId],
  );

  const showAnswer = state.status !== "idle";

  const handleNewQuestion = useCallback(() => {
    abortRef.current?.abort();
    stopFlushInterval();
    tokenBufferRef.current = "";
    setState(initialState);
    setQuestion("");
    setFeedbackSubmitted(false);
    setSuggestions([]);
  }, [stopFlushInterval]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-full flex-col overflow-y-auto">

        {/* ── Input panel — hidden once results are showing ── */}
        {!showAnswer && (
          <div className="flex-shrink-0 border-b border-cream-300 bg-white px-8 py-10">
            {/* Ask hero */}
            <div className="mb-8 text-center">
              <h1 className="font-serif text-[32px] leading-tight tracking-[-0.01em] text-[#1A2B40]">
                What would you likeeeeee to{" "}
                <em className="italic text-gold-500">know?</em>
              </h1>
              <p className="mt-2 text-[14px] text-[#4D6480]">
                Ask any RBI regulatory compliance question — answers cite exact circulars.
              </p>
            </div>

            {/* Ask card */}
            <div className="mx-auto max-w-3xl rounded-2xl border border-cream-300 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="e.g. What are the revised KYC norms for digital lending NBFCs under the latest RBI master direction?"
                  rows={4}
                  maxLength={500}
                  className="w-full resize-none border-none bg-transparent text-[14.5px] leading-relaxed text-[#1A2B40] placeholder-[#B0A898] focus:outline-none"
                />

                {/* Suggestions dropdown */}
                {suggestionList.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-cream-300 bg-white shadow-lg">
                    {suggestionList.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setQuestion(s.question_text);
                            setShowSuggestions(false);
                          }}
                          className="block w-full px-4 py-3 text-left transition-colors hover:bg-cream-100"
                        >
                          <div className="flex items-start gap-2">
                            <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <div className="text-sm text-[#1A2B40] line-clamp-1">{s.question_text}</div>
                              {s.quick_answer_preview && (
                                <div className="mt-0.5 text-xs text-[#7A95AD] line-clamp-1">
                                  {s.quick_answer_preview}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Card footer: char count + button */}
              <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-4">
                <span className="text-[11.5px] text-[#7A95AD]">{question.length} / 500</span>
                <button
                  onClick={handleAsk}
                  disabled={state.status === "streaming" || question.trim().length < 5}
                  className="flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-6 py-2.5 text-[13.5px] font-medium tracking-wide text-white shadow-[0_4px_14px_rgba(15,28,46,0.3)] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(15,28,46,0.4)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-500">
                    <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  Get Interpretation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Answer / Idle area ───────────────────────────── */}
        <div className="flex-1 bg-cream-100 px-8 py-8" ref={answerRef}>

          {/* New Question bar — shown while streaming or after done/error */}
          {showAnswer && (
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs text-[#7A95AD]">
                {state.status === "streaming" ? "Generating your interpretation…" : "Interpretation complete"}
              </p>
              <button
                onClick={handleNewQuestion}
                className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-5 py-2 text-sm font-medium text-[#4D6480] shadow-sm transition-all hover:border-gold-500 hover:text-[#1A2B40] active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Question
              </button>
            </div>
          )}

          {/* Error banner */}
          {state.status === "error" && state.errorMessage && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{state.errorMessage}</span>
              </div>
            </div>
          )}

          {/* Answer view */}
          {showAnswer && (
            <AnswerView
              question={question}
              quickAnswer={state.quickAnswer}
              answer={state.answer}
              riskLevel={state.riskLevel}
              confidenceScore={state.confidenceScore}
              consultExpert={state.consultExpert}
              citations={state.citations}
              affectedTeams={state.affectedTeams}
              recommendedActions={state.recommendedActions}
              isStreaming={state.status === "streaming"}
              questionId={state.questionId}
              creditBalance={state.creditBalance}
              onFeedback={state.status === "done" ? handleFeedback : undefined}
              isFeedbackSubmitting={isFeedbackSubmitting}
              feedbackSubmitted={feedbackSubmitted}
            />
          )}

          {/* Idle state — suggested questions */}
          {state.status === "idle" && (
            <div className="mx-auto max-w-3xl">
              {/* Section label */}
              <div className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A95AD]">
                Suggested Questions
              </div>

              {/* Question cards grid */}
              <div className="mb-8 grid gap-3 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((sq, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuestion(sq)}
                    className="group flex items-start gap-3 rounded-xl border border-cream-300 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-gold-500 hover:shadow-[0_3px_12px_rgba(201,151,46,0.12)]"
                  >
                    <div className="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md bg-cream-200">
                      <svg className="h-[11px] w-[11px] text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                      </svg>
                    </div>
                    <span className="text-[13px] leading-relaxed text-[#4D6480] group-hover:text-[#1A2B40]">
                      {sq}
                    </span>
                  </button>
                ))}
              </div>

              {/* Tips section label */}
              <div className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A95AD]">
                Tips for Better Answers
              </div>

              {/* Tips card — matches HTML dark navy card */}
              <div className="flex gap-3.5 rounded-xl p-5" style={{ background: "linear-gradient(135deg, #1E3050, #162236)" }}>
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(201,151,46,0.15)]">
                  <svg className="h-4 w-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                </div>
                <div>
                  <div className="mb-2 text-[12.5px] font-semibold text-[#D0DFF0]">Tips for better answers</div>
                  <ul className="space-y-1">
                    {[
                      "Be specific about the regulation or circular you\u2019re asking about",
                      "Include relevant context such as entity type, transaction size, and timeline",
                      "Mention any recent circulars you are already aware of",
                    ].map((tip) => (
                      <li key={tip} className="relative pl-3.5 text-[12px] text-[#7A95AD]">
                        <span className="absolute left-0 text-gold-500 text-[14px] leading-[1.2]">›</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
