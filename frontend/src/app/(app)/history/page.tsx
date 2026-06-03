"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { bandFor } from "@/components/ui/ConfidenceMeter";
import { Pagination } from "@/components/ui/Pagination";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useQuestionHistory } from "@/hooks/useQuestions";
import { cn } from "@/lib/cn";

type FilterTab = "all" | "high_confidence" | "consult_export" | "this_week";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high_confidence", label: "High Confidence" },
  { id: "consult_export", label: "Consult Export" },
  { id: "this_week", label: "This Week" },
];

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: "bg-red-50", text: "text-red-700" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700" },
  LOW: { bg: "bg-green-50", text: "text-green-700" },
};

function ConfidencePill({
  score,
  consultExpert,
}: {
  score: number | null;
  consultExpert: boolean;
}) {
  if (score === null && !consultExpert) return null;
  const band = bandFor(score, consultExpert);
  const pct = consultExpert ? 0 : Math.round((score ?? 0) * 100);

  if (consultExpert) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Consult expert
      </span>
    );
  }

  const colorMap: Record<string, string> = {
    high: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-orange-100 text-orange-700",
    fallback: "bg-rose-100 text-rose-700",
  };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", colorMap[band])}>
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
      </svg>
      {pct}%
    </span>
  );
}

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuestionHistory(page, PAGE_SIZE);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const totalPages = data
    ? (data.total_pages ?? Math.max(1, Math.ceil(data.total / PAGE_SIZE)))
    : 0;
  const showPagination = !!data && data.total > PAGE_SIZE;

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.data;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.question_text.toLowerCase().includes(q) ||
          (i.quick_answer ?? "").toLowerCase().includes(q),
      );
    }

    if (activeTab === "high_confidence") {
      items = items.filter((i) => !i.consult_expert && (i.confidence_score ?? 0) >= 0.8);
    } else if (activeTab === "consult_export") {
      items = items.filter((i) => i.consult_expert);
    } else if (activeTab === "this_week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      items = items.filter((i) => new Date(i.created_at) >= weekAgo);
    }

    return items;
  }, [data, activeTab, search]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-cream-300 bg-white px-8 py-4 dark:border-navy-700 dark:bg-navy-900">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-navy-900 text-white"
                    : "border border-cream-300 text-[#4D6480] hover:border-gold-500 hover:text-[#1A2B40] dark:border-navy-600 dark:text-gray-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <p className="text-[13px] text-[#7A95AD]">
                <span className="font-medium text-[#1A2B40]">{data.total}</span> results
              </p>
            )}
            {/* Search */}
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A95AD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search history..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-52 rounded-lg border border-cream-300 bg-cream-100 py-1.5 pl-9 pr-4 text-[13px] text-[#1A2B40] placeholder-[#7A95AD] focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-100"
              />
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all hover:shadow-md">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {isLoading && <CardListSkeleton rows={6} />}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
            Failed to load question history. Please try again.
          </div>
        )}

        {data && filtered.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-cream-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-[13px] text-[#7A95AD]">
              {search ? "No results match your search." : "No questions yet."}
            </p>
            {!search && (
              <Link href="/ask" className="mt-2 text-[13px] font-medium text-gold-500 hover:text-gold-600">
                Ask your first question
              </Link>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((q) => {
              const riskColors = q.risk_level
                ? RISK_COLORS[q.risk_level.toUpperCase()] ?? RISK_COLORS["MEDIUM"]
                : null;
              const hasFullAnswer = !q.consult_expert && q.quick_answer;

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-cream-300 bg-white shadow-sm transition-all hover:-translate-y-px hover:border-[#C9972E40] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-800"
                >
                  <div className="p-4">
                    {/* Top row: title + risk badge */}
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13.5px] font-medium text-[#1A2B40] dark:text-gray-100">
                        {q.question_text}
                      </p>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {q.risk_level && riskColors && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                              riskColors.bg,
                              riskColors.text,
                            )}
                          >
                            {q.risk_level}
                          </span>
                        )}
                        {/* Bookmark icon for answered questions */}
                        {hasFullAnswer && (
                          <svg
                            className="h-4 w-4 text-gray-300 dark:text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Answer preview */}
                    {q.quick_answer && (
                      <p
                        className={cn(
                          "mt-1.5 text-xs line-clamp-2",
                          q.consult_expert
                            ? "italic text-gray-400 dark:text-gray-500"
                            : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        {q.quick_answer}
                      </p>
                    )}

                    {/* Bottom row */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Confidence pill */}
                        <ConfidencePill
                          score={q.confidence_score}
                          consultExpert={q.consult_expert}
                        />

                        {/* Feedback badges */}
                        {q.feedback_record?.is_helpful === false && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                            Not helpful
                          </span>
                        )}
                        {q.feedback_record?.is_helpful === true && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Helpful
                          </span>
                        )}

                        {/* Date */}
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(q.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* View Full Answer link */}
                      {hasFullAnswer && (
                        <Link
                          href={`/history/${q.id}`}
                          className="ml-auto text-[12px] font-medium text-gold-600 hover:text-gold-500"
                        >
                          View Full Answer →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {showPagination && (
        <div className="shrink-0 border-t border-cream-300 px-8 py-4 dark:border-navy-700">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            className="justify-start"
          />
        </div>
      )}
      </div>
    </div>
  );
}
