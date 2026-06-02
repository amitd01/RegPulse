"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { listNews } from "@/lib/api/news";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/stores/authStore";
import { bandFor } from "@/components/ui/ConfidenceMeter";
import type { PaginatedResponse, QuestionSummary } from "@/types";

const PLAN_CREDIT_LIMIT = 500;

interface ActionItemRow {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
}

interface ActionStats {
  pending: number;
  in_progress: number;
}

function useRecentQuestions() {
  return useQuery<PaginatedResponse<QuestionSummary>>({
    queryKey: ["questions", "recent", "roots"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<QuestionSummary>>("/questions", {
        params: { page: 1, page_size: 5, roots_only: true },
      });
      // Main questions only (no follow-ups in a conversation thread)
      const mains = data.data.filter((q) => !q.parent_question_id);
      return { ...data, data: mains };
    },
    staleTime: 30_000,
  });
}

function useQuestionsTotal() {
  return useQuery<number>({
    queryKey: ["questions", "total"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<QuestionSummary>>("/questions", {
        params: { page: 1, page_size: 1 },
      });
      return data.total;
    },
    staleTime: 30_000,
  });
}

function useLatestNews() {
  return useQuery({
    queryKey: ["news", "dashboard"],
    queryFn: () => listNews({ page: 1, page_size: 3 }),
    staleTime: 60_000,
  });
}

function usePendingActions() {
  return useQuery({
    queryKey: ["action-items", "dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/action-items", { params: { page: 1, page_size: 4 } });
      return data as { data: ActionItemRow[]; total: number };
    },
    staleTime: 60_000,
  });
}

function useActionStats() {
  return useQuery<ActionStats>({
    queryKey: ["action-items-stats"],
    queryFn: async () => {
      const { data } = await api.get("/action-items/stats");
      return data;
    },
    staleTime: 60_000,
  });
}

function formatPlanLabel(plan: string): string {
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

function formatRenewDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function confidenceTagClass(
  score: number | null,
  consultExpert: boolean,
): string {
  const band = bandFor(score, consultExpert);
  switch (band) {
    case "high":
      return "bg-[#DCFCE7] text-[#16A34A]";
    case "medium":
      return "bg-[#FEF3C7] text-[#B45309]";
    case "low":
      return "bg-[#FFEDD5] text-[#C2410C]";
    default:
      return "bg-[#FEE2E2] text-[#DC2626]";
  }
}

function priorityTagClass(priority: string): string {
  switch (priority?.toUpperCase()) {
    case "HIGH":
      return "bg-[#FEE2E2] text-[#DC2626]";
    case "MEDIUM":
      return "bg-[#FEF3C7] text-[#B45309]";
    default:
      return "bg-[#DCFCE7] text-[#16A34A]";
  }
}

function priorityShort(priority: string): string {
  switch (priority?.toUpperCase()) {
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Med";
    default:
      return "Low";
  }
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value <= 0) {
      setDisplay(0);
      return;
    }
    let start = 0;
    const step = value / (1200 / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(Math.floor(start));
      if (start >= value) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: recent, isLoading: questionsLoading } = useRecentQuestions();
  const { data: questionsTotalCount } = useQuestionsTotal();
  const { data: news, isLoading: newsLoading } = useLatestNews();
  const { data: actions, isLoading: actionsLoading } = usePendingActions();
  const { data: actionStats } = useActionStats();

  const firstName = user?.full_name?.split(" ")[0] ?? "";
  const creditBalance = user?.credit_balance ?? 0;
  const creditPct = Math.min(100, Math.round((creditBalance / PLAN_CREDIT_LIMIT) * 100));
  const openActions = (actionStats?.pending ?? 0) + (actionStats?.in_progress ?? 0);
  const questionsTotal = questionsTotalCount ?? 0;

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  const pendingActionItems =
    actions?.data.filter((a) => a.status !== "COMPLETED").slice(0, 4) ?? [];

  return (
    <div className="bg-[#F5F2EB] px-9 py-6 dark:bg-navy-950">
      {/* Welcome row */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[30px] leading-tight tracking-[-0.01em] text-[#1A2B40] dark:text-gray-100">
            Welcome, <span className="italic text-gold-500">{firstName || "there"}</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-[#4D6480] dark:text-gray-400">
            Your RBI regulatory intelligence dashboard.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[#E4DDD2] bg-white px-3.5 py-1.5 text-[11.5px] text-[#7A95AD] dark:border-navy-700 dark:bg-navy-900">
          <svg className="h-3 w-3 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2} />
            <path d="M16 2v4M8 2v4M3 10h18" strokeWidth={2} />
          </svg>
          {todayLabel}
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCardCredits balance={creditBalance} pct={creditPct} />
        <StatCardPlan
          plan={formatPlanLabel(user?.plan ?? "free")}
          renews={formatRenewDate(user?.plan_expires_at)}
        />
        <StatCardQuestions total={questionsTotal} />
      </div>

      {/* Quick actions */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickCard
          href="/ask"
          title="Ask a Question"
          desc="Get cited RBI answers"
          iconClass="bg-[rgba(201,151,46,0.1)] text-gold-500"
          icon={
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth={1.8} />
              <path d="m21 21-4.35-4.35" strokeWidth={1.8} />
            </svg>
          }
        />
        <QuickCard
          href="/library"
          title="Browse Library"
          desc="Search circulars"
          iconClass="bg-[rgba(15,28,46,0.08)] text-navy-900"
          icon={
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
              />
            </svg>
          }
        />
        <QuickCard
          href="/action-items"
          title="Action Items"
          desc="Track compliance tasks"
          iconClass="bg-[rgba(99,102,241,0.1)] text-indigo-500"
          icon={
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"
              />
            </svg>
          }
        />
        <QuickCard
          href="/saved"
          title="Saved"
          desc="Your saved interpretations"
          iconClass="bg-[rgba(34,197,94,0.1)] text-[#16A34A]"
          icon={
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          }
        />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        {/* Recent Questions */}
        <div className="overflow-hidden rounded-2xl border border-[#E4DDD2] bg-white dark:border-navy-700 dark:bg-navy-900">
          <div className="flex items-center justify-between border-b border-[#F0EBE2] px-6 py-3.5 dark:border-navy-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2B40] dark:text-gray-100">
              <span className="h-[7px] w-[7px] rounded-full bg-gold-500" />
              Recent Questions
            </div>
            <Link
              href="/history"
              className="text-xs font-medium text-[#A07820] transition-colors hover:text-gold-500"
            >
              View all →
            </Link>
          </div>

          {questionsLoading && (
            <div className="flex justify-center py-10">
              <Spinner size="sm" />
            </div>
          )}

          {!questionsLoading && recent && recent.data.length === 0 && (
            <p className="px-[22px] py-8 text-sm text-[#7A95AD]">
              No questions yet.{" "}
              <Link href="/ask" className="font-medium text-[#A07820] hover:text-gold-500">
                Ask your first question
              </Link>
            </p>
          )}

          {recent?.data.map((q, i) => (
            <Link
              key={q.id}
              href={`/ask?thread=${q.id}`}
              className="group flex items-start gap-3.5 border-b border-[#F5F1EB] px-6 py-3 transition-colors last:border-b-0 hover:bg-[#FAFAF7] dark:border-navy-800 dark:hover:bg-navy-800/50"
            >
              <span className="mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[7px] border border-[#E4DDD2] bg-[#F5F2EB] text-[11px] font-semibold text-[#7A95AD]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium leading-snug text-[#1A2B40] dark:text-gray-100">
                  {q.question_text}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {(q.confidence_score !== null || q.consult_expert) && (
                    <span
                      className={cn(
                        "rounded-[5px] px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                        confidenceTagClass(q.confidence_score, q.consult_expert),
                      )}
                    >
                      {q.consult_expert
                        ? "Consult expert"
                        : `${Math.round((q.confidence_score ?? 0) * 100)}%`}
                    </span>
                  )}
                  <span className="text-[11px] text-[#7A95AD]">
                    {new Date(q.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <span className="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border border-[#E4DDD2] bg-[#F5F2EB] transition-colors group-hover:border-[rgba(201,151,46,0.3)] group-hover:bg-[rgba(201,151,46,0.18)]">
                <svg
                  className="h-2.5 w-2.5 text-[#7A95AD] group-hover:text-gold-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Latest Updates */}
          <div className="overflow-hidden rounded-2xl border border-[#E4DDD2] bg-white dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center justify-between border-b border-[#F0EBE2] px-5 py-3.5 dark:border-navy-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2B40] dark:text-gray-100">
                <span className="h-[7px] w-[7px] rounded-full bg-[#22C55E]" />
                Latest Updates
              </div>
              <Link
                href="/updates"
                className="text-xs font-medium text-[#A07820] transition-colors hover:text-gold-500"
              >
                {news?.total ? `${Math.min(news.total, 99)} new` : "View all"}
              </Link>
            </div>

            {newsLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            )}

            {!newsLoading && news?.items.length === 0 && (
              <p className="px-[18px] py-6 text-xs text-[#7A95AD]">No updates yet.</p>
            )}

            {news?.items.map((item, idx) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border-b border-[#F5F1EB] px-5 py-3 transition-colors last:border-b-0 hover:bg-[#FAFAF7] dark:border-navy-800 dark:hover:bg-navy-800/50"
              >
                <div className="mb-1 flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                      idx === 0 ? "animate-pulse bg-gold-500" : "bg-[#7A95AD]",
                    )}
                  />
                  <div className="flex-1 text-[13px] font-semibold leading-snug text-[#1A2B40] dark:text-gray-100">
                    {item.title}
                  </div>
                </div>
                {item.published_at && (
                  <div className="mb-1 ml-3.5 text-[11px] text-[#7A95AD]">
                    {new Date(item.published_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                )}
                {item.summary && (
                  <p className="ml-3.5 line-clamp-2 text-[11.5px] leading-snug text-[#4D6480]">
                    {item.summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                  </p>
                )}
              </a>
            ))}
          </div>

          {/* Pending Actions */}
          <div className="overflow-hidden rounded-2xl border border-[#E4DDD2] bg-white dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center justify-between border-b border-[#F0EBE2] px-5 py-3.5 dark:border-navy-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2B40] dark:text-gray-100">
                <span className="h-[7px] w-[7px] rounded-full bg-indigo-500" />
                Pending Actions
              </div>
              <Link
                href="/action-items"
                className="text-xs font-medium text-[#A07820] transition-colors hover:text-gold-500"
              >
                {openActions > 0 ? `${openActions} open` : "View all"}
              </Link>
            </div>

            {actionsLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            )}

            {!actionsLoading && pendingActionItems.length === 0 && (
              <p className="px-[18px] py-6 text-xs text-[#7A95AD]">No pending action items.</p>
            )}

            {pendingActionItems.map((item) => (
              <Link
                key={item.id}
                href="/action-items"
                className="flex items-center gap-3 border-b border-[#F5F1EB] px-5 py-3 transition-colors last:border-b-0 hover:bg-[#FAFAF7] dark:border-navy-800 dark:hover:bg-navy-800/50"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px] border-2",
                    item.status === "COMPLETED"
                      ? "border-navy-900 bg-navy-900"
                      : "border-[#C8C0B2]",
                  )}
                >
                  {item.status === "COMPLETED" && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[#1A2B40] dark:text-gray-100">
                    {item.title}
                  </p>
                  {item.due_date && (
                    <p className="mt-0.5 text-[11px] text-[#7A95AD]">
                      Due{" "}
                      {new Date(item.due_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "flex-shrink-0 rounded-[5px] px-[7px] py-0.5 text-[9.5px] font-bold tracking-wide",
                    priorityTagClass(item.priority),
                  )}
                >
                  {priorityShort(item.priority)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCardCredits({ balance, pct }: { balance: number; pct: number }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#E4DDD2] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[rgba(201,151,46,0.35)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.07)] dark:border-navy-700 dark:bg-navy-900">
      <div className="pointer-events-none absolute -right-7 -top-7 h-[100px] w-[100px] rounded-full bg-[#E8B84B] opacity-[0.06]" />
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.17em] text-[#7A95AD]">
          Credits Remaining
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[rgba(201,151,46,0.1)] text-gold-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6l4 2" />
          </svg>
        </span>
      </div>
      <div className="mb-2.5 font-serif text-[32px] leading-none tracking-[-0.02em] text-[#1A2B40] dark:text-gray-100">
        <CountUp value={balance} />
      </div>
      <div className="mb-3 h-[5px] overflow-hidden rounded-full bg-[#EEE8DF]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-[#7A95AD]">of {PLAN_CREDIT_LIMIT} · monthly</span>
        <Link
          href="/upgrade"
          className="flex-shrink-0 rounded-[7px] bg-gradient-to-br from-gold-400 to-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-[0_3px_10px_rgba(201,151,46,0.28)] transition-all hover:-translate-y-px"
        >
          Upgrade
        </Link>
      </div>
    </div>
  );
}

function StatCardPlan({ plan, renews }: { plan: string; renews: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#E4DDD2] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[rgba(201,151,46,0.35)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.07)] dark:border-navy-700 dark:bg-navy-900">
      <div className="pointer-events-none absolute -right-7 -top-7 h-[100px] w-[100px] rounded-full bg-indigo-500 opacity-[0.06]" />
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.17em] text-[#7A95AD]">
          Current Plan
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[rgba(99,102,241,0.1)] text-indigo-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </span>
      </div>
      <div className="mb-1.5 font-serif text-[28px] leading-none text-[#3B5BDB]">{plan}</div>
      <p className="mb-3 text-[11.5px] text-[#7A95AD]">
        {PLAN_CREDIT_LIMIT} credits/mo · upgrade for team features
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-[#7A95AD]">Renews {renews}</span>
        <Link
          href="/account"
          className="flex-shrink-0 rounded-[7px] bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_3px_10px_rgba(15,28,46,0.14)] transition-all hover:-translate-y-px"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

function StatCardQuestions({ total }: { total: number }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#E4DDD2] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[rgba(201,151,46,0.35)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.07)] dark:border-navy-700 dark:bg-navy-900">
      <div className="pointer-events-none absolute -right-7 -top-7 h-[100px] w-[100px] rounded-full bg-[#22C55E] opacity-[0.06]" />
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.17em] text-[#7A95AD]">
          Questions Asked
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[rgba(34,197,94,0.1)] text-[#22C55E]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
            />
          </svg>
        </span>
      </div>
      <div className="mb-3 font-serif text-[32px] leading-none tracking-[-0.02em] text-[#1A2B40] dark:text-gray-100">
        <CountUp value={total} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-[#7A95AD]">All-time questions</span>
        <Link
          href="/history"
          className="flex-shrink-0 rounded-[7px] border border-[#DDD7CC] bg-transparent px-3 py-1.5 text-xs font-semibold text-[#4D6480] transition-colors hover:border-gold-500 hover:text-[#1A2B40]"
        >
          View History
        </Link>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  title,
  desc,
  icon,
  iconClass,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-[14px] border border-[#E4DDD2] bg-white px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-[0_8px_24px_rgba(201,151,46,0.1)] dark:border-navy-700 dark:bg-navy-900"
    >
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px]", iconClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold leading-tight text-[#1A2B40] dark:text-gray-100">
          {title}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-[#7A95AD]">{desc}</div>
      </div>
    </Link>
  );
}
