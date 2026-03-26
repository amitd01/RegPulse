"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge, impactVariant } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assigned_team: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

function useActionItems(page: number, status?: string) {
  return useQuery({
    queryKey: ["action-items", page, status],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (status) params.status = status;
      const { data } = await api.get("/action-items", { params });
      return data as { data: ActionItem[]; total: number; page: number; page_size: number };
    },
  });
}

function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/action-items/${id}`, { status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["action-items"] }),
  });
}

export default function ActionItemsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading } = useActionItems(page, statusFilter);
  const updateStatus = useUpdateStatus();

  return (
    <div className="px-6 py-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Action Items</h1>

      <div className="mb-4 flex gap-2">
        {["", "PENDING", "IN_PROGRESS", "COMPLETED"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s || undefined); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              (statusFilter || "") === s
                ? "bg-navy-700 text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      )}

      {data && data.data.length === 0 && (
        <p className="py-20 text-center text-sm text-gray-500">No action items yet.</p>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={impactVariant(item.priority)}>{item.priority}</Badge>
                    <Badge variant={item.status === "COMPLETED" ? "active" : "default"}>
                      {item.status.replace("_", " ")}
                    </Badge>
                    {item.assigned_team && (
                      <span className="text-xs text-gray-500">{item.assigned_team}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  {item.description && (
                    <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                  )}
                  {item.due_date && (
                    <p className="mt-1 text-xs text-gray-400">
                      Due: {new Date(item.due_date).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
                {item.status !== "COMPLETED" && (
                  <button
                    onClick={() =>
                      updateStatus.mutate({
                        id: item.id,
                        status: item.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED",
                      })
                    }
                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    {item.status === "PENDING" ? "Start" : "Complete"}
                  </button>
                )}
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
