"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";

interface SavedItem {
  id: string;
  question_id: string;
  name: string;
  tags: string[] | null;
  needs_review: boolean;
  created_at: string;
}

function useSavedList(page: number) {
  return useQuery({
    queryKey: ["saved", page],
    queryFn: async () => {
      const { data } = await api.get("/saved", { params: { page, page_size: 20 } });
      return data as { data: SavedItem[]; total: number; page: number };
    },
  });
}

function useDeleteSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/saved/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved"] }),
  });
}

export default function SavedPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSavedList(page);
  const deleteSaved = useDeleteSaved();

  return (
    <div className="px-6 py-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Saved Interpretations</h1>

      {isLoading && (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      )}

      {data && data.data.length === 0 && (
        <p className="py-20 text-center text-sm text-gray-500">
          No saved interpretations yet. Save answers from your Q&A history.
        </p>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {item.needs_review && (
                    <Badge variant="high">Needs Review</Badge>
                  )}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Saved {new Date(item.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link
                  href={`/history/${item.question_id}`}
                  className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  View
                </Link>
                <button
                  onClick={() => deleteSaved.mutate(item.id)}
                  className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && Math.ceil(data.total / 20) > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={Math.ceil(data.total / 20)} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
