
"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { usePaymentHistory, usePlanInfo } from "@/hooks/useSubscriptions";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";

/* ─────────────────────────────────────────────
   Tiny design-system primitives (inline so the
   file is fully self-contained)
───────────────────────────────────────────── */

/** Section card wrapper */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#E4DDD2] bg-white shadow-sm transition-shadow duration-200 hover:shadow-md overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

/** Card header row */
function CardHeader({
  icon,
  iconColor = "gold",
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  iconColor?: "gold" | "indigo" | "slate" | "red";
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const iconBg: Record<string, string> = {
    gold:   "bg-amber-50 text-amber-600 border border-amber-200/60",
    indigo: "bg-indigo-50 text-indigo-500 border border-indigo-200/60",
    slate:  "bg-slate-100 text-slate-600 border border-slate-200",
    red:    "bg-red-50 text-red-500 border border-red-200/60",
  };
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-[#EDE8E0]">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${iconBg[iconColor]}`}>
          {icon}
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[#1A2B40]">{title}</div>
          {description && (
            <div className="text-[11.5px] text-[#7A95AD] mt-0.5">{description}</div>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/** Label + value field */
function Field({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-[#7A95AD] mb-1.5">
        {label}
      </div>
      <div className="text-[14px] font-medium text-[#1A2B40]">{value}</div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-[11.5px] text-amber-600 mt-1 hover:text-amber-500 transition-colors"
        >
          Edit →
        </button>
      )}
    </div>
  );
}

/** Stat cell inside subscription grid */
function SubCell({
  label,
  children,
  noBorder = false,
}: {
  label: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div
      className={`px-5 py-5 ${
        noBorder ? "" : "border-r border-[#EDE8E0]"
      }`}
    >
      <div className="text-[9.5px] font-bold tracking-[0.14em] uppercase text-[#7A95AD] mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SVG Icons
───────────────────────────────────────────── */
const IconUser = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
);
const IconShield = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
  </svg>
);
const IconReceipt = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
  </svg>
);
const IconLock = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z"/>
  </svg>
);
const IconBolt = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
  </svg>
);
const IconDownload = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/>
  </svg>
);
const IconCheck = () => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
  </svg>
);
const IconX = () => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
  </svg>
);
const IconInfo = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
  </svg>
);

/* ─────────────────────────────────────────────
   Plan comparison table
───────────────────────────────────────────── */
const planFeatures = [
  "Monthly credits",
  "Circular search & Q&A",
  "Cited interpretations",
  "Team collaboration",
  "Priority circular alerts",
  "API access",
];
const freePlan  = ["500 / month", true, true, false, false, false];
const proPlan   = ["Unlimited",   true, true, true,  true,  true ];

function PlanCompare() {
  return (
    <div className="grid grid-cols-2 gap-3 mt-5">
      {/* Free */}
      <div className="rounded-xl border border-[#E4DDD2] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE8E0] bg-[#FAFAF7]">
          <span className="text-[12.5px] font-700 text-[#1A2B40] font-bold">Free (Current)</span>
          <span className="text-[11px] text-[#7A95AD]">₹0 / mo</span>
        </div>
        {planFeatures.map((feat, i) => (
          <div key={feat} className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F5F1EB] last:border-0 text-[11.5px] text-[#4D6480]">
            <span className={freePlan[i] === false ? "text-gray-300" : "text-green-600"}>
              {freePlan[i] === false ? <IconX /> : <IconCheck />}
            </span>
            {typeof freePlan[i] === "string" ? (
              <span className="font-medium text-[#1A2B40]">{freePlan[i]}</span>
            ) : feat}
          </div>
        ))}
      </div>

      {/* Pro */}
      <div className="rounded-xl border border-amber-300/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200/40 bg-amber-50/60">
          <span className="text-[12.5px] font-bold text-amber-700">Pro</span>
          <span className="text-[11px] font-semibold text-amber-600">₹2,499 / mo</span>
        </div>
        {planFeatures.map((feat, i) => (
          <div key={feat} className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F5F1EB] last:border-0 text-[11.5px] text-[#4D6480]">
            <span className="text-green-600"><IconCheck /></span>
            {typeof proPlan[i] === "string" ? (
              <span className="font-medium text-[#1A2B40]">{proPlan[i]}</span>
            ) : feat}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function AccountPage() {
  const user       = useAuthStore((s) => s.user);
  const clearAuth  = useAuthStore((s) => s.clearAuth);
  const { data: planData,    isLoading: planLoading    } = usePlanInfo();
  const { data: historyData, isLoading: historyLoading } = usePaymentHistory();

  // Auto-renew
  const [autoRenew,        setAutoRenew]        = useState<boolean | null>(null);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);

  // Deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOtp,       setDeleteOtp]       = useState("");
  const [deleteStep,      setDeleteStep]      = useState<"confirm" | "otp">("confirm");
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [deleteError,     setDeleteError]     = useState("");

  // Export
  const [exportLoading, setExportLoading] = useState(false);

  const isAutoRenew = autoRenew ?? planData?.data.plan_auto_renew ?? true;

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[#7A95AD] text-sm">Please log in to view your account.</p>
      </div>
    );
  }

  /* ── Handlers (unchanged from original) ── */

  async function handleAutoRenewToggle() {
    setAutoRenewLoading(true);
    try {
      await api.patch("/subscriptions/auto-renew", { auto_renew: !isAutoRenew });
      setAutoRenew(!isAutoRenew);
    } catch { /* Silently fail */ } finally {
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
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Deletion failed. Please try again.";
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExportData() {
    setExportLoading(true);
    try {
      const { data } = await api.get("/account/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `regpulse_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* Silently fail */ } finally {
      setExportLoading(false);
    }
  }

  /* ── Render ── */
  return (
    <div className="px-8 py-8 lg:px-10 bg-[#F5F2EB] min-h-full">

      {/* Page heading */}
      <div className="mb-7">
        <h1 className="font-serif text-[32px] leading-tight tracking-tight text-[#1A2B40]">
          Account{" "}
          <em className="italic text-gold-500">& Billing</em>
        </h1>
        <p className="text-[13.5px] text-[#4D6480] mt-1">
          Manage your profile, subscription, and data preferences.
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ══════════ PROFILE ══════════ */}
        <Card>
          <CardHeader
            icon={<IconUser />}
            iconColor="gold"
            title="Profile"
            description="Your personal details and identity"
            action={
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E4DDD2] bg-[#F5F2EB] text-[12.5px] font-medium text-[#4D6480] hover:border-amber-400 transition-colors">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Edit Profile
              </button>
            }
          />

          <div className="px-6 py-6">
            {/* Avatar row */}
            <div className="flex items-center gap-5 pb-6 mb-6 border-b border-[#EDE8E0]">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-[24px] font-bold text-[#0F1C2E]"
                style={{ background: "linear-gradient(135deg, #A07820, #E8B84B)", boxShadow: "0 4px 16px rgba(201,151,46,.3)" }}
              >
                {user.full_name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <div className="text-[20px] font-serif text-[#1A2B40] leading-tight">
                  {user.full_name}
                </div>
                <div className="text-[13px] text-[#7A95AD] mt-0.5">{user.email}</div>
                <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200/70 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Verified Account
                </span>
              </div>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Full Name"     value={user.full_name} onEdit={() => {}} />
              <Field label="Email Address" value={user.email}     onEdit={() => {}} />
              <Field label="Organisation"  value="think360.ai"    onEdit={() => {}} />
              <Field label="Member Since"  value="January 2026" />
            </div>
          </div>
        </Card>

        {/* ══════════ SUBSCRIPTION ══════════ */}
        <Card>
          <CardHeader
            icon={<IconShield />}
            iconColor="indigo"
            title="Subscription"
            description="Your current plan and usage"
            action={
              <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/60 text-indigo-600 px-3 py-1.5 rounded-full text-[11.5px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                {planLoading ? "…" : planData?.data.plan ?? "Free"} Plan
              </span>
            }
          />

          <div className="px-6 py-6">
            {planLoading ? (
              <Spinner size="sm" />
            ) : planData ? (
              <>
                {/* Stats strip */}
                <div className="rounded-xl border border-[#E4DDD2] bg-[#F5F2EB] overflow-hidden mb-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4">
                    <SubCell label="Plan">
                      <div className="text-[22px] font-serif text-indigo-600 leading-none">
                        {planData.data.plan ?? "Free"}
                      </div>
                      <div className="text-[11px] text-[#7A95AD] mt-1">Basic access</div>
                    </SubCell>

                    <SubCell label="Credits Remaining">
                      <div className="text-[22px] font-serif text-[#1A2B40] leading-none">
                        {planData.data.credit_balance}
                      </div>
                      {/* Credits bar */}
                      <div className="mt-2 h-[5px] rounded-full bg-[#E4DDD2] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, ((planData.data.credit_balance ?? 0) / 500) * 100)}%`,
                            background: "linear-gradient(90deg, #A07820, #E8B84B)",
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-[#7A95AD] mt-1">of 500 total</div>
                    </SubCell>

                    <SubCell label="Expires">
                      <div className="text-[16px] font-medium text-[#7A95AD] leading-none mt-1">
                        {planData.data.plan_expires_at
                          ? new Date(planData.data.plan_expires_at).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })
                          : "Never"}
                      </div>
                      <div className="text-[11px] text-[#7A95AD] mt-1">Free plan · no expiry</div>
                    </SubCell>

                    <SubCell label="Auto-Renew" noBorder>
                      <div className="flex items-center gap-2.5 mt-3">
                        <button
                          onClick={handleAutoRenewToggle}
                          disabled={autoRenewLoading}
                          className={`relative inline-flex w-[42px] h-[22px] items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${
                            isAutoRenew ? "bg-[#0F1C2E]" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                              isAutoRenew ? "translate-x-[22px]" : "translate-x-[3px]"
                            }`}
                          />
                        </button>
                        <span className="text-[12.5px] font-medium text-[#1A2B40]">
                          {isAutoRenew ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </SubCell>
                  </div>
                </div>

                {/* Upgrade strip */}
                <div
                  className="flex items-center justify-between rounded-xl px-5 py-4 mb-1"
                  style={{ background: "linear-gradient(135deg, #152133, #1E3050)", border: "1px solid #253B57" }}
                >
                  <div>
                    <div className="text-[14px] font-semibold text-white mb-0.5">
                      Unlock the full power of RegPulse
                    </div>
                    <div className="text-[12px] text-[#5A7E9E]">
                      Unlimited credits, team sharing, priority alerts &amp; API access
                    </div>
                  </div>
                  <Link
                    href="/upgrade"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold text-[#0F1C2E] transition-all hover:-translate-y-px ml-6 flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #E8B84B, #C9972E)",
                      boxShadow: "0 4px 16px rgba(201,151,46,.35)",
                    }}
                  >
                    <IconBolt />
                    Upgrade to Pro
                  </Link>
                </div>

                {/* Plan comparison */}
                <PlanCompare />
              </>
            ) : null}
          </div>
        </Card>

        {/* ══════════ PAYMENT HISTORY ══════════ */}
        <Card>
          <CardHeader
            icon={<IconReceipt />}
            iconColor="slate"
            title="Payment History"
            description="Invoices and billing records"
            action={
              <span className="text-[11.5px] text-[#7A95AD] bg-[#F5F2EB] border border-[#E4DDD2] px-3 py-1.5 rounded-full">
                {historyLoading ? "…" : `${historyData?.data.length ?? 0} transactions`}
              </span>
            }
          />

          <div className="px-6 py-6">
            {historyLoading ? (
              <Spinner size="sm" />
            ) : historyData && historyData.data.length > 0 ? (
              <div className="space-y-3">
                {historyData.data.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-xl border border-[#E4DDD2] bg-[#FAFAF7] px-4 py-3.5 hover:border-amber-300/60 transition-colors"
                  >
                    <div>
                      <div className="text-[13.5px] font-medium capitalize text-[#1A2B40]">
                        {event.plan}
                      </div>
                      <div className="text-[11px] text-[#7A95AD] mt-0.5">
                        {new Date(event.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] font-semibold text-[#1A2B40]">
                        ₹{(event.amount_paise / 100).toLocaleString("en-IN")}
                      </span>
                      <Badge variant={event.status === "captured" ? "active" : "default"}>
                        {event.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-14 h-14 rounded-[14px] bg-[#EDE8DF] border border-[#E4DDD2] flex items-center justify-center mb-4">
                  <IconReceipt />
                </div>
                <div className="text-[14px] font-semibold text-[#1A2B40] mb-1.5">No payments yet</div>
                <div className="text-[12.5px] text-[#7A95AD] max-w-[260px] leading-relaxed">
                  You are on the free plan. When you upgrade, invoices will appear here automatically.
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ══════════ DATA MANAGEMENT ══════════ */}
        <Card>
          <CardHeader
            icon={<IconLock />}
            iconColor="red"
            title="Data Management"
            description="Export or delete your personal data"
          />

          <div className="px-6 py-6">
            {/* DPDP notice */}
            <div className="flex items-start gap-3 bg-amber-50/70 border border-amber-200/50 rounded-xl p-4 mb-6">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <IconInfo />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold text-[#1A2B40] mb-1">
                  Your rights under the DPDP Act
                </div>
                <p className="text-[12px] text-[#4D6480] leading-relaxed">
                  Under the Digital Personal Data Protection Act, 2023, you have the right to access,
                  export, or request deletion of your personal data stored on RegPulse at any time.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Export */}
              <button
                onClick={handleExportData}
                disabled={exportLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] border border-[#E4DDD2] bg-[#F5F2EB] text-[13px] font-medium text-[#1A2B40] hover:border-amber-400 hover:shadow-sm transition-all disabled:opacity-50"
              >
                <IconDownload />
                {exportLoading ? "Exporting…" : "Export My Data"}
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  setShowDeleteModal(true);
                  setDeleteStep("confirm");
                  setDeleteOtp("");
                  setDeleteError("");
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] border border-red-200 bg-white text-[13px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 hover:shadow-sm transition-all"
              >
                <IconTrash />
                Delete Account
              </button>
            </div>
          </div>
        </Card>

      </div>{/* /sections */}

      {/* ══════════ DELETE MODAL ══════════ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-[#EDE8E0]">
              <div className="w-9 h-9 rounded-[10px] bg-red-50 border border-red-200/60 flex items-center justify-center text-red-500">
                <IconTrash />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[#1A2B40]">Delete Account</div>
                <div className="text-[11.5px] text-[#7A95AD]">This action is permanent and irreversible</div>
              </div>
            </div>

            <div className="px-6 py-6">
              {deleteStep === "confirm" ? (
                <>
                  <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={1.8} className="flex-shrink-0 mt-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    </svg>
                    <p className="text-[12.5px] text-red-700 leading-relaxed">
                      Your personal data will be <strong>anonymised</strong>, and your questions,
                      saved interpretations, and action items will be <strong>permanently deleted</strong>.
                      An OTP will be sent to your email for verification.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="px-4 py-2.5 rounded-lg text-[13px] font-medium text-[#4D6480] hover:bg-[#F5F2EB] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestDeletionOTP}
                      disabled={deleteLoading}
                      className="px-5 py-2.5 rounded-lg bg-red-600 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleteLoading ? "Sending OTP…" : "Send Verification OTP"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[#4D6480] mb-5 leading-relaxed">
                    Enter the 6-digit OTP sent to <strong className="text-[#1A2B40]">{user.email}</strong> to confirm account deletion.
                  </p>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={deleteOtp}
                    onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="• • • • • •"
                    className="w-full rounded-xl border border-[#E4DDD2] bg-[#F5F2EB] px-4 py-3.5 text-center text-[22px] tracking-[0.5em] text-[#1A2B40] font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition-all mb-4"
                  />

                  {deleteError && (
                    <div className="flex items-center gap-2 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                      {deleteError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="px-4 py-2.5 rounded-lg text-[13px] font-medium text-[#4D6480] hover:bg-[#F5F2EB] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDeletion}
                      disabled={deleteLoading || deleteOtp.length !== 6}
                      className="px-5 py-2.5 rounded-lg bg-red-600 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleteLoading ? "Deleting…" : "Permanently Delete Account"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}