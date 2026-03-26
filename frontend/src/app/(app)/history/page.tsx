"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, impactVariant } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { useQuestionHistory } from "@/hooks/useQuestions";

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuestionHistory(page, pageSize);

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Question History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your past questions and answers.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load question history. Please try again.
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-gray-500">No questions yet.</p>
          <Link
            href="/ask"
            className="mt-2 text-sm font-medium text-navy-600 hover:text-navy-700"
          >
            Ask your first question
          </Link>
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((q) => (
            <Link
              key={q.id}
              href={`/history/${q.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {q.question_text}
                  </p>
                  {q.quick_answer && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {q.quick_answer}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {q.risk_level && (
                      <Badge variant={impactVariant(q.risk_level)}>
                        {q.risk_level}
                      </Badge>
                    )}
                    {q.feedback === 1 && (
                      <span className="text-xs text-green-600">
                        &#128077; Helpful
                      </span>
                    )}
                    {q.feedback === -1 && (
                      <span className="text-xs text-red-500">
                        &#128078; Not helpful
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(q.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && Math.ceil(data.total / pageSize) > 1 && (
        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={Math.ceil(data.total / pageSize)}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
