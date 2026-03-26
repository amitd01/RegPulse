"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge, impactVariant } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedResponse, QuestionSummary } from "@/types";

function useRecentQuestions() {
  return useQuery<PaginatedResponse<QuestionSummary>>({
    queryKey: ["questions", "recent"],
    queryFn: async () => {
      const { data } = await api.get("/questions", { params: { page: 1, page_size: 5 } });
      return data;
    },
    staleTime: 30_000,
  });
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: recent, isLoading } = useRecentQuestions();

  return (
    <div className="px-6 py-6 lg:px-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user ? `, ${user.full_name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your RBI regulatory intelligence dashboard.
        </p>
      </div>

      {/* Quick stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Credits Remaining"
          value={user?.credit_balance?.toString() ?? "—"}
          href="/upgrade"
          linkText="Upgrade"
        />
        <StatCard
          label="Plan"
          value={user?.plan ?? "free"}
          href="/account"
          linkText="Manage"
        />
        <StatCard
          label="Questions Asked"
          value={recent?.total?.toString() ?? "—"}
          href="/history"
          linkText="View History"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/ask" title="Ask a Question" desc="Get cited RBI answers" />
        <QuickAction href="/library" title="Browse Library" desc="Search circulars" />
        <QuickAction href="/action-items" title="Action Items" desc="Track compliance tasks" />
        <QuickAction href="/saved" title="Saved" desc="Your saved interpretations" />
      </div>

      {/* Recent questions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Recent Questions</h2>
          <Link href="/history" className="text-xs font-medium text-navy-600 hover:text-navy-700">
            View all
          </Link>
        </div>

        {isLoading && <Spinner size="sm" />}

        {recent && recent.data.length === 0 && (
          <p className="text-sm text-gray-500">
            No questions yet.{" "}
            <Link href="/ask" className="text-navy-600 hover:text-navy-700">
              Ask your first question
            </Link>
          </p>
        )}

        {recent && recent.data.length > 0 && (
          <div className="space-y-2">
            {recent.data.map((q) => (
              <Link
                key={q.id}
                href={`/history/${q.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-3 hover:shadow-sm"
              >
                <p className="text-sm font-medium text-gray-900 line-clamp-1">
                  {q.question_text}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {q.risk_level && (
                    <Badge variant={impactVariant(q.risk_level)}>{q.risk_level}</Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(q.created_at).toLocaleDateString("en-IN")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  linkText,
}: {
  label: string;
  value: string;
  href: string;
  linkText: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold capitalize text-gray-900">{value}</div>
      <Link href={href} className="mt-2 block text-xs font-medium text-navy-600">
        {linkText}
      </Link>
    </div>
  );
}

function QuickAction({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white p-4 hover:border-navy-300 hover:shadow-sm"
    >
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="text-xs text-gray-500">{desc}</div>
    </Link>
  );
}
