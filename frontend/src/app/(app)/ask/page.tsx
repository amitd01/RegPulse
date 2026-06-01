"use client";



import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerView } from "@/components/answer/AnswerView";

import { FollowUpComposer } from "@/components/ask/FollowUpComposer";

import { useAuthStore } from "@/stores/authStore";

import { trackEvent } from "@/lib/analytics";

import api from "@/lib/api";

import type { CitationItem, RecommendedAction } from "@/types";



// ─────────────────────────────────────────────────────────────────────────────

// Types

// ─────────────────────────────────────────────────────────────────────────────



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



interface ConversationTurn {

  clientId: string;

  questionText: string;

  state: StreamState;

  feedbackSubmitted: boolean;

}



const initialStreamState: StreamState = {

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



function newTurn(questionText: string): ConversationTurn {

  return {

    clientId: crypto.randomUUID(),

    questionText,

    state: { ...initialStreamState, status: "streaming" },

    feedbackSubmitted: false,

  };

}



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

  const [followUp, setFollowUp] = useState("");

  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const [feedbackByTurn, setFeedbackByTurn] = useState<Record<string, boolean>>({});

  const [submittingFeedbackTurn, setSubmittingFeedbackTurn] = useState<string | null>(null);



  const abortRef = useRef<AbortController | null>(null);

  const answerRef = useRef<HTMLDivElement>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);



  const tokenBufferRef = useRef<string>("");

  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);

  const user = useAuthStore((s) => s.user);



  const isStreaming = turns.some((t) => t.state.status === "streaming");

  const showThread = turns.length > 0;

  const lastTurn = turns[turns.length - 1];

  const lastCompletedParentId =

    [...turns].reverse().find((t) => t.state.status === "done" && t.state.questionId)?.state

      .questionId ?? null;

  const latestCreditBalance =

    [...turns].reverse().find((t) => t.state.creditBalance !== null)?.state.creditBalance ??

    user?.credit_balance ??

    null;



  useEffect(() => {

    return () => {

      abortRef.current?.abort();

      if (flushIntervalRef.current !== null) clearInterval(flushIntervalRef.current);

    };

  }, []);



  const stopFlushInterval = useCallback(() => {

    if (flushIntervalRef.current !== null) {

      clearInterval(flushIntervalRef.current);

      flushIntervalRef.current = null;

    }

  }, []);



  const updateTurnState = useCallback((clientId: string, patch: Partial<StreamState>) => {

    setTurns((prev) =>

      prev.map((t) =>

        t.clientId === clientId ? { ...t, state: { ...t.state, ...patch } } : t,

      ),

    );

  }, []);



  const runQuestionStream = useCallback(

    async (params: {

      questionText: string;

      clientId: string;

      parentQuestionId?: string | null;

    }) => {

      const { questionText, clientId, parentQuestionId } = params;



      tokenBufferRef.current = "";

      stopFlushInterval();

      updateTurnState(clientId, { ...initialStreamState, status: "streaming" });



      trackEvent("ask_question_submitted", {

        question_length: questionText.length,

        is_follow_up: Boolean(parentQuestionId),

      });



      setTimeout(() => {

        threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

      }, 100);



      const controller = new AbortController();

      abortRef.current = controller;



      flushIntervalRef.current = setInterval(() => {

        const pending = tokenBufferRef.current;

        if (!pending) return;

        tokenBufferRef.current = "";

        setTurns((prev) =>

          prev.map((t) =>

            t.clientId === clientId

              ? { ...t, state: { ...t.state, answer: t.state.answer + pending } }

              : t,

          ),

        );

      }, 50);



      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";



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



      try {

        const response = await fetch(`${apiUrl}/questions`, {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

            Accept: "text/event-stream",

            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),

          },

          credentials: "include",

          body: JSON.stringify({

            question: questionText,

            ...(parentQuestionId ? { parent_question_id: parentQuestionId } : {}),

          }),

          signal: controller.signal,

        });



        if (!response.ok) {

          stopFlushInterval();

          const errorData = await response.json().catch(() => null);

          updateTurnState(clientId, {

            status: "error",

            errorMessage: errorData?.error || `Request failed (${response.status})`,

          });

          return;

        }



        const reader = response.body?.getReader();

        if (!reader) {

          stopFlushInterval();

          updateTurnState(clientId, {

            status: "error",

            errorMessage: "No response body",

          });

          return;

        }



        const decoder = new TextDecoder();

        let partial = "";



        const applySseEvent = (eventType: string, data: Record<string, unknown>) => {

          switch (eventType) {

            case "token":

              tokenBufferRef.current += (data.token as string) ?? "";

              break;



            case "citations": {

              stopFlushInterval();

              const pending = tokenBufferRef.current;

              tokenBufferRef.current = "";

              setTurns((prev) =>

                prev.map((t) => {

                  if (t.clientId !== clientId) return t;

                  const fullText = t.state.answer + (pending || "");

                  return {

                    ...t,

                    state: {

                      ...t.state,

                      answer: extractDetailedAnswer(fullText),

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

                    },

                  };

                }),

              );

              trackEvent("confidence_meter_viewed", {

                confidence_score:

                  typeof data.confidence_score === "number" ? data.confidence_score : null,

                consult_expert: Boolean(data.consult_expert),

                source: parentQuestionId ? "ask_follow_up" : "ask",

              });

              break;

            }



            case "done": {

              stopFlushInterval();

              const pending = tokenBufferRef.current;

              tokenBufferRef.current = "";

              setTurns((prev) =>

                prev.map((t) => {

                  if (t.clientId !== clientId) return t;

                  const fullText = pending ? t.state.answer + pending : t.state.answer;

                  return {

                    ...t,

                    state: {

                      ...t.state,

                      status: "done",

                      answer: extractDetailedAnswer(fullText),

                      questionId: (data.question_id as string) ?? null,

                      creditBalance:

                        typeof data.credit_balance === "number"

                          ? data.credit_balance

                          : null,

                    },

                  };

                }),

              );

              if (user && data.credit_balance !== undefined) {

                useAuthStore.setState({

                  user: { ...user, credit_balance: data.credit_balance as number },

                });

              }

              setTimeout(() => {

                threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

              }, 200);

              break;

            }



            case "error":

              stopFlushInterval();

              updateTurnState(clientId, {

                status: "error",

                errorMessage: (data.error as string) ?? "Streaming error",

              });

              break;



            default:

              if (typeof data.token === "string") {

                tokenBufferRef.current += data.token;

              } else if (typeof data.error === "string") {

                stopFlushInterval();

                updateTurnState(clientId, {

                  status: "error",

                  errorMessage: data.error as string,

                });

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

            if (partial.trim()) {

              processSseBuffer(`${partial}\n\n`);

            }

            break;

          }

        }

      } catch (err) {

        stopFlushInterval();

        if (err instanceof DOMException && err.name === "AbortError") return;

        updateTurnState(clientId, {

          status: "error",

          errorMessage: err instanceof Error ? err.message : "Request failed",

        });

      } finally {

        stopFlushInterval();

        const pending = tokenBufferRef.current;

        if (pending) {

          tokenBufferRef.current = "";

          setTurns((prev) =>

            prev.map((t) =>

              t.clientId === clientId

                ? { ...t, state: { ...t.state, answer: t.state.answer + pending } }

                : t,

            ),

          );

        }

        setTurns((prev) =>

          prev.map((t) =>

            t.clientId === clientId && t.state.status === "streaming"

              ? { ...t, state: { ...t.state, status: "done" } }

              : t,

          ),

        );

      }

    },

    [accessToken, user, stopFlushInterval, updateTurnState],

  );



  const handleInitialAsk = useCallback(async () => {

    const text = question.trim();

    if (text.length < 5 || isStreaming) return;



    const turn = newTurn(text);

    setTurns([turn]);

    setQuestion("");

    setFollowUp("");

    setTimeout(() => answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);



    await runQuestionStream({ questionText: text, clientId: turn.clientId });

  }, [question, isStreaming, runQuestionStream]);



  const handleFollowUp = useCallback(async () => {

    const text = followUp.trim();

    if (text.length < 5 || isStreaming || !lastCompletedParentId) return;



    const turn = newTurn(text);

    setTurns((prev) => [...prev, turn]);

    setFollowUp("");



    await runQuestionStream({

      questionText: text,

      clientId: turn.clientId,

      parentQuestionId: lastCompletedParentId,

    });

  }, [followUp, isStreaming, lastCompletedParentId, runQuestionStream]);



  const handleKeyDown = useCallback(

    (e: React.KeyboardEvent) => {

      if (e.key === "Enter" && !e.shiftKey) {

        e.preventDefault();

        handleInitialAsk();

      }

    },

    [handleInitialAsk],

  );



  const handleFeedback = useCallback(

    async (

      turnClientId: string,

      questionId: string,

      payload: { comment: string; category: string; is_helpful: boolean },

    ) => {

      setSubmittingFeedbackTurn(turnClientId);

      try {

        await api.patch(`/questions/${questionId}/feedback`, {

          is_helpful: payload.is_helpful,

          category: payload.category || null,

          comment: payload.comment || null,

        });

        setFeedbackByTurn((prev) => ({ ...prev, [turnClientId]: true }));

        setTurns((prev) =>

          prev.map((t) =>

            t.clientId === turnClientId ? { ...t, feedbackSubmitted: true } : t,

          ),

        );

      } catch {

        // silent fail

      } finally {

        setSubmittingFeedbackTurn(null);

      }

    },

    [],

  );



  const handleNewQuestion = useCallback(() => {

    abortRef.current?.abort();

    stopFlushInterval();

    tokenBufferRef.current = "";

    setTurns([]);

    setQuestion("");

    setFollowUp("");

    setFeedbackByTurn({});

  }, [stopFlushInterval]);



  const canFollowUp =

    Boolean(lastCompletedParentId) &&

    lastTurn?.state.status === "done" &&

    !isStreaming;



  return (

    <div className="flex h-full flex-col overflow-hidden">

      <div className="flex h-full min-h-0 flex-col">



        {/* ── Input panel — hidden once thread starts ── */}

        {!showThread && (

          <div className="flex-shrink-0 border-b border-cream-300 bg-white px-8 py-10">

            <div className="mb-8 text-center">

              <h1 className="font-serif text-[32px] leading-tight tracking-[-0.01em] text-[#1A2B40]">

                What would you like to{" "}

                <em className="italic text-gold-500">know?</em>

              </h1>

              <p className="mt-2 text-[14px] text-[#4D6480]">

                Ask any RBI regulatory compliance question — answers cite exact circulars.

              </p>

            </div>



            <div className="mx-auto max-w-3xl rounded-2xl border border-cream-300 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">

              <div className="relative">

                <textarea

                  value={question}

                  onChange={(e) => setQuestion(e.target.value)}

                  onKeyDown={handleKeyDown}

                  placeholder="e.g. What are the revised KYC norms for digital lending NBFCs under the latest RBI master direction?"

                  rows={4}

                  maxLength={500}

                  className="w-full resize-none border-none bg-transparent text-[14.5px] leading-relaxed text-[#1A2B40] placeholder-[#B0A898] focus:outline-none"

                />

              </div>



              <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-4">

                <span className="text-[11.5px] text-[#7A95AD]">{question.length} / 500 · 1 credit</span>

                <button

                  onClick={handleInitialAsk}

                  disabled={isStreaming || question.trim().length < 5}

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



        {/* ── Conversation thread ── */}

        <div

          className={`flex min-h-0 flex-1 flex-col bg-cream-100 ${showThread ? "overflow-hidden" : "overflow-y-auto"}`}

          ref={answerRef}

        >

          {showThread && (

            <>

              <div className="flex-shrink-0 border-b border-cream-300 bg-white/80 px-8 py-3 backdrop-blur-sm">

                <div className="mx-auto flex max-w-3xl items-center justify-between">

                  <div>

                    <p className="text-xs font-medium text-[#4D6480]">

                      {isStreaming ? "Generating interpretation…" : "Conversation"}

                    </p>

                    {latestCreditBalance !== null && (

                      <p className="text-[11px] text-[#7A95AD]">

                        <span className="font-semibold text-gold-600">{latestCreditBalance}</span>{" "}

                        credits remaining

                      </p>

                    )}

                  </div>

                  <button

                    onClick={handleNewQuestion}

                    className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-medium text-[#4D6480] shadow-sm transition-all hover:border-gold-500 hover:text-[#1A2B40]"

                  >

                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />

                    </svg>

                    New conversation

                  </button>

                </div>

              </div>



              <div className="flex-1 overflow-y-auto px-8 py-6">

                <div className="mx-auto max-w-3xl space-y-10">

                  {turns.map((turn, index) => (

                    <div key={turn.clientId} className="space-y-4">

                      {turn.state.status === "error" && turn.state.errorMessage && (

                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                          {turn.state.errorMessage}

                        </div>

                      )}



                      <AnswerView

                        variant={index === 0 ? "primary" : "followup"}

                        question={turn.questionText}

                        quickAnswer={turn.state.quickAnswer}

                        answer={turn.state.answer}

                        riskLevel={turn.state.riskLevel}

                        confidenceScore={turn.state.confidenceScore}

                        consultExpert={turn.state.consultExpert}

                        citations={turn.state.citations}

                        affectedTeams={turn.state.affectedTeams}

                        recommendedActions={turn.state.recommendedActions}

                        isStreaming={turn.state.status === "streaming"}

                        questionId={turn.state.questionId}

                        creditBalance={

                          index === 0 && index === turns.length - 1

                            ? turn.state.creditBalance

                            : undefined

                        }

                        onFeedback={

                          index === 0 &&

                          turn.state.status === "done" &&

                          turn.state.questionId

                            ? (data) =>

                                handleFeedback(turn.clientId, turn.state.questionId!, data)

                            : undefined

                        }

                        isFeedbackSubmitting={

                          index === 0 ? submittingFeedbackTurn === turn.clientId : false

                        }

                        feedbackSubmitted={

                          index === 0

                            ? turn.feedbackSubmitted || feedbackByTurn[turn.clientId]

                            : false

                        }

                      />

                    </div>

                  ))}

                  <div ref={threadEndRef} className="h-4" />

                </div>

              </div>



              {canFollowUp && (

                <FollowUpComposer

                  value={followUp}

                  onChange={setFollowUp}

                  onSubmit={handleFollowUp}

                  isStreaming={isStreaming}

                  creditBalance={latestCreditBalance}

                  turnCount={turns.length}

                />

              )}

            </>

          )}



          {/* Idle — suggested questions */}

          {!showThread && (

            <div className="flex-1 overflow-y-auto px-8 py-8">

              <div className="mx-auto max-w-3xl">

                <div className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A95AD]">

                  Suggested Questions

                </div>



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



                <div className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A95AD]">

                  Tips for Better Answers

                </div>



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

            </div>

          )}

        </div>

      </div>

    </div>

  );

}


