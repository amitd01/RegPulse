"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
function AlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01" />
    </svg>
  );
}
function Calendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function FileText({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function User({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}
import api from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assigned_team: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  source_question_id: string | null;
  source_circular_id: string | null;
  is_overdue: boolean;
  created_at: string;
}

interface Stats {
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

type TabKey = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";

function useActionItems(page: number, status?: string) {
  return useQuery({
    queryKey: ["action-items", page, status],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (status && status !== "OVERDUE") params.status = status;
      const { data } = await api.get("/action-items", { params });
      return data as { data: ActionItem[]; total: number; page: number; page_size: number };
    },
  });
}

function useStats() {
  return useQuery({
    queryKey: ["action-items-stats"],
    queryFn: async () => {
      const { data } = await api.get("/action-items/stats");
      return data as Stats;
    },
  });
}

function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/action-items/${id}`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["action-items"] });
      qc.invalidateQueries({ queryKey: ["action-items-stats"] });
    },
  });
}

function daysRemaining(due_date: string | null): number | null {
  if (!due_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(due_date);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function borderColor(item: ActionItem): string {
  if (item.is_overdue) return "border-l-red-500";
  if (item.status === "COMPLETED") return "border-l-green-500";
  if (item.status === "IN_PROGRESS") return "border-l-green-400";
  if (item.priority === "HIGH") return "border-l-crimson-600";
  if (item.priority === "MEDIUM") return "border-l-amber-400";
  return "border-l-gray-300";
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "HIGH")
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-red-600">
        High Priority
      </span>
    );
  if (priority === "MEDIUM")
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        Medium Priority
      </span>
    );
  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      Low Priority
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "IN_PROGRESS")
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600">
        <CheckCircle2 className="h-3 w-3" /> In Progress
      </span>
    );
  if (status === "COMPLETED")
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  return null;
}

function DaysChip({ item }: { item: ActionItem }) {
  const days = daysRemaining(item.due_date);
  if (days === null) return null;
  if (item.is_overdue)
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
        <AlertCircle className="h-3 w-3" />
        {Math.abs(days)} days overdue
      </span>
    );
  if (days === 0)
    return <span className="text-xs font-medium text-orange-600">Due today</span>;
  if (days < 0)
    return (
      <span className="text-xs font-medium text-red-600">{Math.abs(days)} days overdue</span>
    );
  return <span className="text-xs text-gray-500">{days} days remaining</span>;
}

function sourceLabel(item: ActionItem): string {
  if (item.source_question_id) return "Q&A Interpretation";
  if (item.source_circular_id) return "Circular";
  return "Manual";
}

function ActionButton({
  item,
  onUpdate,
  loading,
}: {
  item: ActionItem;
  onUpdate: (id: string, status: string) => void;
  loading: boolean;
}) {
  if (item.status === "COMPLETED") return null;

  if (item.status === "IN_PROGRESS") {
    return (
      <button
        disabled={loading}
        onClick={() => onUpdate(item.id, "COMPLETED")}
        className="whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
      >
        Update Status
      </button>
    );
  }

  // PENDING
  if (item.priority === "HIGH") {
    return (
      <button
        disabled={loading}
        onClick={() => onUpdate(item.id, "COMPLETED")}
        className="whitespace-nowrap rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-2 text-xs font-semibold text-white transition hover:shadow-md disabled:opacity-50"
      >
        Mark Complete
      </button>
    );
  }

  return (
    <button
      disabled={loading}
      onClick={() => onUpdate(item.id, "IN_PROGRESS")}
      className="whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
    >
      View Details
    </button>
  );
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All Tasks" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "OVERDUE", label: "Overdue" },
];

export default function ActionItemsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [page, setPage] = useState(1);

  const statusParam = activeTab === "ALL" || activeTab === "OVERDUE" ? undefined : activeTab;
  const { data, isLoading } = useActionItems(page, statusParam);
  const { data: stats } = useStats();
  const updateStatus = useUpdateStatus();

  const total = stats
    ? (stats.pending ?? 0) + (stats.in_progress ?? 0) + (stats.completed ?? 0)
    : 0;

  function tabCount(key: TabKey): number {
    if (!stats) return 0;
    if (key === "ALL") return total;
    if (key === "PENDING") return stats.pending;
    if (key === "IN_PROGRESS") return stats.in_progress;
    if (key === "COMPLETED") return stats.completed;
    if (key === "OVERDUE") return stats.overdue;
    return 0;
  }

  const items =
    data?.data.filter((item) => {
      if (activeTab === "OVERDUE") return item.is_overdue;
      return true;
    }) ?? [];

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-8">

      {/* Page heading */}
      <h2 className="mb-5 font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">Action Items</h2>

      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-cream-300 dark:border-navy-700">
        {TABS.map((tab) => {
          const count = tabCount(tab.key);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`relative -mb-px px-4 pb-3 pt-2 text-[13.5px] font-medium transition-colors ${
                active
                  ? "border-b-2 border-navy-900 text-[#1A2B40] dark:border-gold-400 dark:text-gold-400"
                  : "text-[#7A95AD] hover:text-[#1A2B40] dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active
                      ? "bg-navy-900 text-white"
                      : "bg-cream-200 text-[#4D6480]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No action items here.</p>
          <p className="mt-1 text-xs text-gray-400">
            Action items are auto-generated when you ask a question.
          </p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => {
            const days = daysRemaining(item.due_date);
            return (
              <div
                key={item.id}
                className={`rounded-xl border border-cream-300 border-l-4 bg-white shadow-sm transition hover:shadow-md dark:border-navy-700 dark:bg-navy-800 ${borderColor(item)}`}
              >
                <div className="flex items-start justify-between gap-4 p-5">
                  {/* Left content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-[#1A2B40] dark:text-white leading-snug">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        From: {sourceLabel(item)}
                      </span>
                      {item.due_date && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          Due:{" "}
                          {new Date(item.due_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {item.assigned_team && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          Assigned to: {item.assigned_team}
                        </span>
                      )}
                      {item.status === "IN_PROGRESS" && <StatusBadge status={item.status} />}
                      {item.status === "COMPLETED" && <StatusBadge status={item.status} />}
                    </div>
                  </div>

                  {/* Right controls */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <PriorityBadge priority={item.priority} />
                    {days !== null && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <DaysChip item={item} />
                      </div>
                    )}
                    <ActionButton
                      item={item}
                      loading={updateStatus.isPending}
                      onUpdate={(id, status) => updateStatus.mutate({ id, status })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More / Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          {page < totalPages ? (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Load More Tasks
            </button>
          ) : (
            <p className="text-xs text-gray-400">All tasks loaded</p>
          )}
        </div>
      )}

      </div>
    </div>
  );
}
