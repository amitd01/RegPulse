"use client";

import { useCallback, useState } from "react";
import { CircularCard } from "@/components/library/CircularCard";
import { FilterPanel } from "@/components/library/FilterPanel";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useCircularList, useCircularSearch } from "@/hooks/useCirculars";
import { useAuthStore } from "@/stores/authStore";
import type { CircularFilters } from "@/types";

const DEFAULT_FILTERS: CircularFilters = {
  page: 1,
  page_size: 20,
  sort_by: "issued_date",
  sort_order: "desc",
};

export default function LibraryPage() {
  const [filters, setFilters] = useState<CircularFilters>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<CircularFilters>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isSearchMode = searchQuery.length >= 3;

  const listQuery = useCircularList(filters);
  const searchResults = useCircularSearch(
    searchQuery,
    { ...filters, page: filters.page, page_size: filters.page_size },
    isSearchMode && isAuthenticated,
  );

  const activeQuery = isSearchMode && isAuthenticated ? searchResults : listQuery;
  const { data, isLoading, isError, error } = activeQuery;

  const handlePendingFilterChange = useCallback(
    (key: keyof CircularFilters, value: string) => {
      setPendingFilters((prev) => ({
        ...prev,
        [key]: value || undefined,
        page: key === "page" ? Number(value) || 1 : 1,
      }));
    },
    [],
  );

  const handleApplyFilters = useCallback(() => {
    setFilters({ ...pendingFilters, page: 1 });
  }, [pendingFilters]);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPendingFilters(DEFAULT_FILTERS);
    setSearchQuery("");
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, []);

  return (
    <div className="min-h-screen">
      {/* Page body */}
      <div className="px-8 py-8">
        <h2 className="mb-6 font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">
          Regulatory Document Library
        </h2>

        <div className="flex gap-8 items-start">
          {/* Left filter sidebar */}
          <FilterPanel
            filters={pendingFilters}
            onFilterChange={handlePendingFilterChange}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />

          {/* Right content area */}
          <div className="min-w-0 flex-1">
            {/* Top bar: results count + search */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[13px] text-[#4D6480]">
                {isLoading ? (
                  <span className="animate-pulse">Loading documents…</span>
                ) : data ? (
                  <span>
                    Showing{" "}
                    <strong className="text-[#1A2B40] dark:text-gray-200">
                      {data.total}
                    </strong>{" "}
                    active documents
                  </span>
                ) : null}
              </div>

              <div className="w-72">
                <SearchInput
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder={
                    isAuthenticated
                      ? "Search documents…"
                      : "Log in to enable AI search"
                  }
                />
                {isSearchMode && !isAuthenticated && (
                  <p className="mt-1 text-xs text-amber-600">
                    Sign in to use hybrid search.
                  </p>
                )}
              </div>
            </div>

            {/* Loading */}
            {isLoading && <CardListSkeleton rows={6} />}

            {/* Error */}
            {isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                Failed to load documents.{" "}
                {error instanceof Error ? error.message : "Please try again."}
              </div>
            )}

            {/* Results */}
            {data && data.data.length > 0 && (
              <div className="space-y-4">
                {data.data.map((circular) => (
                  <CircularCard key={circular.id} circular={circular} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {data && data.data.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <svg
                  className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No circulars match your filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-2 text-[13px] font-medium text-gold-600 hover:text-gold-500"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Pagination */}
            {data && data.total_pages > 1 && (
              <div className="mt-6">
                <Pagination
                  page={data.page}
                  totalPages={data.total_pages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
