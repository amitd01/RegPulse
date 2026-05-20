"use client";

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
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 px-8 py-8">
        <div className="mb-8">
          <h2 className="font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">
            Welcome{user ? `, ${user.full_name?.split(" ")[0]}` : ""}
          </h2>
          <p className="mt-1 text-[13.5px] text-[#4D6480]">
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
          <Link href="/history" className="text-xs font-medium text-crimson-700 hover:text-crimson-800 dark:text-crimson-400">
            View all
          </Link>
        </div>

        {isLoading && <Spinner size="sm" />}

        {recent && recent.data.length === 0 && (
          <p className="text-sm text-gray-500">
            No questions yet.{" "}
            <Link href="/ask" className="text-crimson-700 hover:text-crimson-800 dark:text-crimson-400">
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
                className="block rounded-xl border border-cream-300 bg-white p-3.5 transition-all hover:border-[#C9972E40] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-800"
              >
                <p className="text-[13.5px] font-medium text-[#1A2B40] dark:text-gray-100 line-clamp-1">
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
    <div className="rounded-xl border border-cream-300 bg-white p-5 shadow-sm hover:shadow-md transition-shadow dark:border-navy-700 dark:bg-navy-800">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7A95AD]">{label}</div>
      <div className="mt-1.5 text-2xl font-bold capitalize text-[#1A2B40] dark:text-gray-100">{value}</div>
      <Link href={href} className="mt-2 block text-xs font-medium text-crimson-700 hover:text-crimson-800 dark:text-crimson-400">
        {linkText}
      </Link>
    </div>
  );
}

function QuickAction({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-crimson-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-crimson-700"
    >
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="text-xs text-gray-500">{desc}</div>
    </Link>
  );
}
