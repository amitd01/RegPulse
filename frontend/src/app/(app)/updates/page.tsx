"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge, impactVariant, statusVariant } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import type { CircularListItem, PaginatedResponse } from "@/types";

function useRecentCirculars(page: number) {
  return useQuery<PaginatedResponse<CircularListItem>>({
    queryKey: ["circulars", "updates", page],
    queryFn: async () => {
      const { data } = await api.get("/circulars", {
        params: { page, page_size: 20, sort_by: "indexed_at", sort_order: "desc" },
      });
      return data;
    },
    staleTime: 60_000,
  });
}

export default function UpdatesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRecentCirculars(page);

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Regulatory Updates</h1>
        <p className="mt-1 text-sm text-gray-500">Latest RBI circulars and notifications.</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {data && data.data.length === 0 && (
        <p className="py-20 text-center text-sm text-gray-500">No updates yet.</p>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((c) => (
            <Link
              key={c.id}
              href={`/library/${c.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {c.circular_number && (
                  <span className="text-xs font-semibold text-navy-600">{c.circular_number}</span>
                )}
                <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                {c.impact_level && (
                  <Badge variant={impactVariant(c.impact_level)}>{c.impact_level}</Badge>
                )}
                <span className="text-xs text-gray-400">{c.doc_type.replace(/_/g, " ")}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{c.title}</p>
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

      {data && data.total_pages > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
