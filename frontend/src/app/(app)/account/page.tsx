"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { usePaymentHistory, usePlanInfo } from "@/hooks/useSubscriptions";
import { useAuthStore } from "@/stores/authStore";

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const { data: planData, isLoading: planLoading } = usePlanInfo();
  const { data: historyData, isLoading: historyLoading } = usePaymentHistory();

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Please log in to view your account.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Account</h1>

      {/* User info */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Profile
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-gray-500">Name</div>
            <div className="text-sm font-medium">{user.full_name}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Email</div>
            <div className="text-sm font-medium">{user.email}</div>
          </div>
        </div>
      </div>

      {/* Plan info */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Subscription
          </h2>
          <Link
            href="/upgrade"
            className="text-sm font-medium text-navy-600 hover:text-navy-700"
          >
            Upgrade
          </Link>
        </div>

        {planLoading ? (
          <Spinner size="sm" className="mt-4" />
        ) : planData ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">Plan</div>
              <div className="text-sm font-medium capitalize">
                {planData.data.plan}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Credits</div>
              <div className="text-sm font-bold text-navy-700">
                {planData.data.credit_balance}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Expires</div>
              <div className="text-sm font-medium">
                {planData.data.plan_expires_at
                  ? new Date(planData.data.plan_expires_at).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" },
                    )
                  : "Never (free plan)"}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Payment history */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Payment History
        </h2>

        {historyLoading ? (
          <Spinner size="sm" />
        ) : historyData && historyData.data.length > 0 ? (
          <div className="space-y-3">
            {historyData.data.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
              >
                <div>
                  <div className="text-sm font-medium capitalize">
                    {event.plan}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(event.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {"\u20b9"}
                    {(event.amount_paise / 100).toLocaleString()}
                  </span>
                  <Badge
                    variant={
                      event.status === "captured" ? "active" : "default"
                    }
                  >
                    {event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payments yet.</p>
        )}
      </div>
    </div>
  );
}
