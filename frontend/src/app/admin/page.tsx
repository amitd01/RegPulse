/**
 * Admin dashboard — v2 terminal-modern (S7a).
 *
 * Editorial spec sheet: 8 metrics laid out in a panel grid with mono labels
 * and tnum values. Pending reviews highlighted via var(--bad).
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface DashboardStats {
  total_users: number;
  active_users_30d: number;
  total_questions: number;
  questions_today: number;
  total_circulars: number;
  pending_reviews: number;
  avg_feedback_score: number | null;
  credits_consumed_30d: number;
}

function useAdminDashboard() {
  return useQuery<{ success: boolean; data: DashboardStats }>({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/admin/dashboard");
      return data;
    },
    staleTime: 30_000,
  });
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING ADMIN DASHBOARD…
      </div>
    );
  }

  const stats = data?.data;

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-dashboard">
      <div className="tick" style={{ marginBottom: 8 }}>
        ADMIN · OVERVIEW · LIVE
      </div>
      <h1
        className="serif"
        style={{
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          marginBottom: 22,
          color: "var(--ink)",
        }}
      >
        Operations dashboard.
      </h1>

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          <Cell label="TOTAL USERS" value={stats.total_users} />
          <Cell label="ACTIVE (30D)" value={stats.active_users_30d} />
          <Cell label="QUESTIONS · TOTAL" value={stats.total_questions} />
          <Cell label="QUESTIONS · TODAY" value={stats.questions_today} signal />
          <Cell label="CIRCULARS" value={stats.total_circulars} />
          <Cell
            label="PENDING REVIEWS"
            value={stats.pending_reviews}
            tone={stats.pending_reviews > 0 ? "bad" : undefined}
          />
          <Cell
            label="AVG FEEDBACK"
            value={
              stats.avg_feedback_score !== null
                ? stats.avg_feedback_score.toFixed(2)
                : "—"
            }
          />
          <Cell label="CREDITS USED (30D)" value={stats.credits_consumed_30d} />
        </div>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  signal = false,
  tone,
}: {
  label: string;
  value: string | number;
  signal?: boolean;
  tone?: "bad";
}) {
  const color =
    tone === "bad" ? "var(--bad)" : signal ? "var(--signal)" : "var(--ink)";
  return (
    <div className="panel" style={{ padding: 16 }} data-testid="admin-stat-cell">
      <div
        className="mono up"
        style={{
          fontSize: 10,
          color: "var(--ink-4)",
          letterSpacing: ".08em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="tnum"
        style={{ fontSize: 26, fontWeight: 600, color, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
    </div>
  );
}
