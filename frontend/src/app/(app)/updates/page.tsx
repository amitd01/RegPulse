"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { listNews, sourceLabel, type NewsListResponse } from "@/lib/api/news";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { CardListSkeleton } from "@/components/ui/Skeleton";

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
  const [newsPage, setNewsPage] = useState(1);

  const { data: newsData, isLoading: newsLoading } = useNews(newsPage, true);
  const markSeen = useMarkUpdatesSeen();

  // Fire mark-seen once on first mount of the page.
  useEffect(() => {
    markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 px-8 py-8">
        <h2 className="mb-6 font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">
          Regulatory Updates
        </h2>

      {/* Circulars tab — temporarily hidden (available in Document Repository)
      {false && (
        <>
          ... circulars content ...
        </>
      )}
      */}

      {/* Market news feed */}
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

      </div>
    </div>
  );
}
