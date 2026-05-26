"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { listNews, sourceLabel, type NewsListResponse } from "@/lib/api/news";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { CardListSkeleton } from "@/components/ui/Skeleton";

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "RBI_PRESS", label: "RBI Press" },
  { value: "BUSINESS_STANDARD", label: "Business Standard" },
  { value: "LIVEMINT", label: "LiveMint" },
  { value: "ET_BANKING", label: "ET Banking" },
] as const;

const selectClass =
  "rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-[13px] text-[#1A2B40] shadow-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-200";

function useMarkUpdatesSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/circulars/updates/mark-seen");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circulars", "updates-badge"] }),
  });
}

function useNews(
  page: number,
  source: string,
  onlyLinked: boolean,
  enabled: boolean,
) {
  return useQuery<NewsListResponse>({
    queryKey: ["news", page, source, onlyLinked],
    queryFn: () =>
      listNews({
        page,
        page_size: 20,
        ...(source ? { source } : {}),
        ...(onlyLinked ? { only_linked: true } : {}),
      }),
    staleTime: 60_000,
    enabled,
  });
}

function stripHtml(input: string | null): string {
  if (!input) return "";
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function UpdatesPage() {
  const [newsPage, setNewsPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState("");
  const [onlyLinked, setOnlyLinked] = useState(false);

  const { data: newsData, isLoading: newsLoading } = useNews(
    newsPage,
    sourceFilter,
    onlyLinked,
    true,
  );
  const markSeen = useMarkUpdatesSeen();

  const totalPages = newsData ? Math.ceil(newsData.total / newsData.page_size) : 0;

  useEffect(() => {
    markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSourceChange = (value: string) => {
    setSourceFilter(value);
    setNewsPage(1);
  };

  const handleLinkedChange = (checked: boolean) => {
    setOnlyLinked(checked);
    setNewsPage(1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-8 py-8">
      <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">
          Regulatory Updates
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className={selectClass}
            value={sourceFilter}
            onChange={(e) => handleSourceChange(e.target.value)}
            aria-label="Filter by source"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#4D6480] dark:text-gray-400">
            <input
              type="checkbox"
              checked={onlyLinked}
              onChange={(e) => handleLinkedChange(e.target.checked)}
              className="h-4 w-4 rounded border-cream-300 text-gold-600 focus:ring-gold-500/30"
            />
            Linked to circular
          </label>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {newsLoading && <CardListSkeleton rows={6} />}

          {newsData && newsData.items.length === 0 && !newsLoading && (
            <p className="py-20 text-center text-sm text-gray-500 dark:text-gray-400">
              No updates match your filters.
            </p>
          )}

          {newsData && newsData.items.length > 0 && (
            <div className="space-y-3">
              {newsData.items.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-cream-300 bg-white p-4 transition-all hover:-translate-y-px hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-800"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge>{sourceLabel(item.source)}</Badge>
                    {item.linked_circular_id && (
                      <Badge variant="active">Linked to circular</Badge>
                    )}
                    {item.relevance_score !== null && (
                      <span className="text-xs text-gray-400">
                        relevance {Math.round(item.relevance_score * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                      {stripHtml(item.summary)}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    {item.published_at && (
                      <span>
                        {new Date(item.published_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {newsData && totalPages > 1 && (
          <div className="mt-4 shrink-0 border-t border-cream-300 pt-4 dark:border-navy-700">
            <Pagination
              page={newsPage}
              totalPages={totalPages}
              onPageChange={setNewsPage}
              className="justify-start"
            />
          </div>
        )}
      </div>
    </div>
  );
}
