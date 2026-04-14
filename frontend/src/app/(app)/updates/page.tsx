"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { listNews, sourceLabel, type NewsListResponse } from "@/lib/api/news";
import { Badge, impactVariant, statusVariant } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import type { CircularListItem, PaginatedResponse } from "@/types";

type Tab = "circulars" | "news";
type UpdatesFilter = "all" | "week" | "high";

interface UpdatesFeedResponse extends PaginatedResponse<CircularListItem> {
  unread_count: number;
}

function useUpdatesFeed(page: number, filter: UpdatesFilter, enabled: boolean) {
  return useQuery<UpdatesFeedResponse>({
    queryKey: ["circulars", "updates", page, filter],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      params.days = filter === "week" ? 7 : 30;
      if (filter === "high") params.impact_level = "HIGH";
      const { data } = await api.get("/circulars/updates", { params });
      return data;
    },
    staleTime: 60_000,
    enabled,
  });
}

function useMarkUpdatesSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/circulars/updates/mark-seen");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circulars", "updates-badge"] }),
  });
}

function useNews(page: number, enabled: boolean) {
  return useQuery<NewsListResponse>({
    queryKey: ["news", page],
    queryFn: () => listNews({ page, page_size: 20 }),
    staleTime: 60_000,
    enabled,
  });
}

function stripHtml(input: string | null): string {
  if (!input) return "";
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function UpdatesPage() {
  const [tab, setTab] = useState<Tab>("circulars");
  const [filter, setFilter] = useState<UpdatesFilter>("all");
  const [circPage, setCircPage] = useState(1);
  const [newsPage, setNewsPage] = useState(1);

  const { data: circData, isLoading: circLoading } = useUpdatesFeed(
    circPage,
    filter,
    tab === "circulars",
  );
  const { data: newsData, isLoading: newsLoading } = useNews(newsPage, tab === "news");
  const markSeen = useMarkUpdatesSeen();

  // Fire mark-seen once on first mount of the page.
  useEffect(() => {
    markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Regulatory Updates
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          RBI circulars and curated banking news.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab("circulars")}
          className={`border-b-2 px-3 pb-2 text-sm font-medium ${
            tab === "circulars"
              ? "border-navy-600 text-navy-700 dark:border-navy-300 dark:text-navy-200"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Circulars
        </button>
        <button
          onClick={() => setTab("news")}
          className={`border-b-2 px-3 pb-2 text-sm font-medium ${
            tab === "news"
              ? "border-navy-600 text-navy-700 dark:border-navy-300 dark:text-navy-200"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Market News
        </button>
      </div>

      {/* Circulars tab */}
      {tab === "circulars" && (
        <>
          {/* Filter chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: "All" },
                { key: "week", label: "This Week" },
                { key: "high", label: "High Impact" },
              ] as { key: UpdatesFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setCircPage(1);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === f.key
                    ? "border-navy-600 bg-navy-50 text-navy-700 dark:border-navy-300 dark:bg-navy-900/40 dark:text-navy-200"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {circLoading && <CardListSkeleton rows={6} />}

          {circData && circData.data.length === 0 && (
            <p className="py-20 text-center text-sm text-gray-500 dark:text-gray-400">
              No updates yet.
            </p>
          )}

          {circData && circData.data.length > 0 && (
            <div className="space-y-3">
              {circData.data.map((c) => (
                <Link
                  key={c.id}
                  href={`/library/${c.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {c.circular_number && (
                      <span className="text-xs font-semibold text-navy-600">
                        {c.circular_number}
                      </span>
                    )}
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    {c.impact_level && (
                      <Badge variant={impactVariant(c.impact_level)}>
                        {c.impact_level}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400">
                      {c.doc_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {c.title}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    {c.issued_date && (
                      <span>
                        {new Date(c.issued_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {c.department && <span>{c.department}</span>}
                  </div>
                  {c.tags && c.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}

          {circData && circData.total_pages > 1 && (
            <div className="mt-6">
              <Pagination
                page={circPage}
                totalPages={circData.total_pages}
                onPageChange={setCircPage}
              />
            </div>
          )}
        </>
      )}

      {/* News tab */}
      {tab === "news" && (
        <>
          {newsLoading && <CardListSkeleton rows={6} />}

          {newsData && newsData.items.length === 0 && (
            <p className="py-20 text-center text-sm text-gray-500 dark:text-gray-400">
              No news ingested yet.
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
                  className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900"
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
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="mt-1 text-xs text-gray-600 line-clamp-2">
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

          {newsData && newsData.total > 20 && (
            <div className="mt-6">
              <Pagination
                page={newsPage}
                totalPages={Math.ceil(newsData.total / 20)}
                onPageChange={setNewsPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
