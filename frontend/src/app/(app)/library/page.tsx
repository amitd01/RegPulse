"use client";

import { useCallback, useState } from "react";
import { CircularCard } from "@/components/library/CircularCard";
import { FilterPanel } from "@/components/library/FilterPanel";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
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
  const [searchQuery, setSearchQuery] = useState("");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isSearchMode = searchQuery.length >= 3;

  // Use search hook when searching, list hook otherwise
  const listQuery = useCircularList(filters);
  const searchResults = useCircularSearch(
    searchQuery,
    { ...filters, page: filters.page, page_size: filters.page_size },
    isSearchMode && isAuthenticated,
  );

  const activeQuery = isSearchMode && isAuthenticated ? searchResults : listQuery;
  const { data, isLoading, isError, error } = activeQuery;

  const handleFilterChange = useCallback(
    (key: keyof CircularFilters, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value || undefined,
        page: key === "page" ? Number(value) || 1 : 1,
      }));
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
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
    <div className="px-6 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Circular Library</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and search RBI circulars, master directions, and notifications.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={
            isAuthenticated
              ? "Search circulars with AI-powered hybrid search..."
              : "Log in to enable AI-powered search. Browse below."
          }
          className="max-w-2xl"
        />
        {isSearchMode && !isAuthenticated && (
          <p className="mt-1 text-xs text-amber-600">
            Sign in to use hybrid search. Showing filtered list instead.
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      </div>

      {/* Results count */}
      {data && (
        <div className="mb-4 text-sm text-gray-500">
          {data.total === 0
            ? "No circulars found"
            : `Showing ${(data.page - 1) * data.page_size + 1}–${Math.min(
                data.page * data.page_size,
                data.total,
              )} of ${data.total} circulars`}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load circulars.{" "}
          {error instanceof Error ? error.message : "Please try again."}
        </div>
      )}

      {/* Results grid */}
      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((circular) => (
            <CircularCard key={circular.id} circular={circular} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {data && data.data.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="mb-4 h-12 w-12 text-gray-300"
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
          <p className="text-sm text-gray-500">No circulars match your filters.</p>
          <button
            onClick={handleResetFilters}
            className="mt-2 text-sm font-medium text-navy-600 hover:text-navy-700"
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
  );
}
