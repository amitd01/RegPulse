"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useSavedInterpretations } from "@/hooks/useSavedInterpretations";
import type { SavedInterpretation } from "@/types";

function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function filterItems(items: SavedInterpretation[], search: string): SavedInterpretation[] {
  if (!search.trim()) return items;

  const q = search.toLowerCase();
  return items.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      (i.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
  );
}

export default function SavedPage() {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const pageSize = 50;

  const { data, isLoading, isError } = useSavedInterpretations(1, pageSize);
  const items = useMemo(() => data?.data ?? [], [data]);

  const filtered = useMemo(
    () => filterItems(items, appliedSearch),
    [items, appliedSearch],
  );

  const handleSearch = () => {
    setAppliedSearch(searchInput.trim());
  };

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8">
        <h2 className="mb-6 font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">
          Saved Interpretations
        </h2>

        {/* Search bar */}
        <div className="mb-6 flex items-center gap-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Search saved items..."
            className="flex-1 rounded-lg border border-cream-300 bg-white px-3 py-2 text-[13.5px] text-[#1A2B40] placeholder-[#7A95AD] shadow-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-200"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-[13.5px] font-medium text-[#4D6480] transition-colors hover:border-gold-500 hover:text-[#1A2B40]"
          >
            Search
          </button>
        </div>

        {isLoading && <CardListSkeleton rows={3} />}

        {isError && (
          <p className="py-20 text-center text-sm text-red-600">
            Failed to load saved interpretations. Please try again.
          </p>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <p className="py-20 text-center text-sm text-gray-500">
            {items.length === 0
              ? "No saved interpretations yet. Save one from a Q&A answer."
              : "No saved interpretations match your search."}
          </p>
        )}

        {!isLoading && !isError && (
          <div className="space-y-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-cream-300 bg-white p-5 shadow-sm transition hover:border-[#C9972E40] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-800"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-[13.5px] font-semibold text-[#1A2B40] dark:text-gray-100">
                    {item.name}
                  </h2>
                  {!item.needs_review ? (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Current
                    </span>
                  ) : (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                        />
                      </svg>
                      Update Available
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Saved: {formatSavedDate(item.created_at)}
                  </span>
                </div>

                {/* Update notice */}
                {item.needs_review && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-900/20">
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      />
                    </svg>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      A cited circular may have been updated or superseded. This interpretation
                      may need review.
                    </p>
                  </div>
                )}

                {/* Tags */}
                {(item.tags ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(item.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/history/${item.question_id}`}
                    className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {item.needs_review ? "Review Update" : "View"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
