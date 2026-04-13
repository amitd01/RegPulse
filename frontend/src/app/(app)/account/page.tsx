"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { usePaymentHistory, usePlanInfo } from "@/hooks/useSubscriptions";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: planData, isLoading: planLoading } = usePlanInfo();
  const { data: historyData, isLoading: historyLoading } = usePaymentHistory();

  // Auto-renew toggle state
  const [autoRenew, setAutoRenew] = useState<boolean | null>(null);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);

  // Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteStep, setDeleteStep] = useState<"confirm" | "otp">("confirm");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Export state
  const [exportLoading, setExportLoading] = useState(false);

  // Derive auto-renew from plan data if not overridden
  const isAutoRenew = autoRenew ?? planData?.data.plan_auto_renew ?? true;

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Please log in to view your account.</p>
      </div>
    );
  }

  // --- Handlers ---

  async function handleAutoRenewToggle() {
    setAutoRenewLoading(true);
    try {
      await api.patch("/subscriptions/auto-renew", {
        auto_renew: !isAutoRenew,
      });
      setAutoRenew(!isAutoRenew);
    } catch {
      // Silently fail — user can retry
    } finally {
      setAutoRenewLoading(false);
    }
  }

  async function handleRequestDeletionOTP() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.post("/account/request-deletion-otp");
      setDeleteStep("otp");
    } catch {
      setDeleteError("Failed to send OTP. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleConfirmDeletion() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.patch("/account/delete", { otp: deleteOtp });
      clearAuth();
      window.location.href = "/login";
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Deletion failed. Please try again.";
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExportData() {
    setExportLoading(true);
    try {
      const { data } = await api.get("/account/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `regpulse_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div className="px-6 py-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Account
      </h1>

      {/* User info */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Profile
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Name</div>
            <div className="text-sm font-medium dark:text-gray-200">
              {user.full_name}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Email
            </div>
            <div className="text-sm font-medium dark:text-gray-200">
              {user.email}
            </div>
          </div>
        </div>
      </div>

      {/* Plan info */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Subscription
          </h2>
          <Link
            href="/upgrade"
            className="text-sm font-medium text-navy-600 hover:text-navy-700 dark:text-blue-400"
          >
            Upgrade
          </Link>
        </div>

        {planLoading ? (
          <Spinner size="sm" className="mt-4" />
        ) : planData ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Plan
              </div>
              <div className="text-sm font-medium capitalize dark:text-gray-200">
                {planData.data.plan}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Credits
              </div>
              <div className="text-sm font-bold text-navy-700 dark:text-blue-400">
                {planData.data.credit_balance}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Expires
              </div>
              <div className="text-sm font-medium dark:text-gray-200">
                {planData.data.plan_expires_at
                  ? new Date(planData.data.plan_expires_at).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" },
                    )
                  : "Never (free plan)"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Auto-Renew
              </div>
              <button
                onClick={handleAutoRenewToggle}
                disabled={autoRenewLoading}
                className={`mt-1 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isAutoRenew
                    ? "bg-navy-600 dark:bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoRenew ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Payment history */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Payment History
        </h2>

        {historyLoading ? (
          <Spinner size="sm" />
        ) : historyData && historyData.data.length > 0 ? (
          <div className="space-y-3">
            {historyData.data.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700"
              >
                <div>
                  <div className="text-sm font-medium capitalize dark:text-gray-200">
                    {event.plan}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(event.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium dark:text-gray-200">
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No payments yet.
          </p>
        )}
      </div>

      {/* Data Management (DPDP) */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Data Management
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Under the Digital Personal Data Protection Act, you have the right to
          export or delete your personal data.
        </p>

        <div className="flex flex-wrap gap-3">
          {/* Export Data */}
          <button
            onClick={handleExportData}
            disabled={exportLoading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {exportLoading ? "Exporting..." : "Export My Data"}
          </button>

          {/* Delete Account */}
          <button
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteStep("confirm");
              setDeleteOtp("");
              setDeleteError("");
            }}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Delete Account
            </h3>

            {deleteStep === "confirm" ? (
              <>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  This action is <strong>permanent and irreversible</strong>.
                  Your personal data will be anonymised, and your questions,
                  saved interpretations, and action items will be deleted. An OTP
                  will be sent to your email for verification.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestDeletionOTP}
                    disabled={deleteLoading}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteLoading ? "Sending OTP..." : "Send Verification OTP"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Enter the 6-digit OTP sent to your email to confirm account
                  deletion.
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={deleteOtp}
                  onChange={(e) =>
                    setDeleteOtp(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter OTP"
                  className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-widest dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
                {deleteError && (
                  <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                    {deleteError}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDeletion}
                    disabled={deleteLoading || deleteOtp.length !== 6}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteLoading
                      ? "Deleting..."
                      : "Permanently Delete Account"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
