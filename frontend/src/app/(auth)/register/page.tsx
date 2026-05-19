/**
 * Registration page — work email + profile → OTP sent. v2 terminal-modern.
 *
 * Behaviour preserved: TanStack mutation against registerUser, honeypot field
 * hidden off-screen, on success router.push('/verify?email=...&purpose=register').
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { type AxiosError } from "axios";
import { registerUser, type ApiError, type RegisterRequest } from "@/lib/api/auth";

const ORG_TYPES: { value: string; label: string }[] = [
  { value: "BANK", label: "Bank" },
  { value: "NBFC", label: "NBFC" },
  { value: "COOPERATIVE", label: "Cooperative Bank" },
  { value: "PAYMENT_BANK", label: "Payment Bank" },
  { value: "SMALL_FINANCE_BANK", label: "Small Finance Bank" },
  { value: "FINTECH", label: "Fintech" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "OTHER", label: "Other" },
];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  color: "var(--ink-4)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const fieldStyle: React.CSSProperties = { marginBottom: 14 };

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState<RegisterRequest>({
    email: "",
    full_name: "",
    designation: "",
    org_name: "",
    org_type: "",
    honeypot: "",
  });

  const mutation = useMutation<unknown, AxiosError<ApiError>, RegisterRequest>({
    mutationFn: registerUser,
    onSuccess: () => {
      const params = new URLSearchParams({ email: form.email, purpose: "register" });
      router.push(`/verify?${params.toString()}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const errorMsg = mutation.error?.response?.data?.error || mutation.error?.message;

  return (
    <>
      <div className="tick" style={{ marginBottom: 14 }}>
        CREATE ACCOUNT · WORK EMAIL ONLY
      </div>

      <h1
        className="serif"
        style={{
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.15,
          marginBottom: 8,
        }}
      >
        Open your terminal.
      </h1>
      <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 22 }}>
        Five lifetime credits to ask cited questions over RBI circulars. Your work email is the
        only gate.
      </p>

      <form onSubmit={handleSubmit} aria-label="register-form">
        {/* Honeypot — hidden from real users, bots fill it. */}
        <input
          type="text"
          name="honeypot"
          value={form.honeypot}
          onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
          style={{ position: "absolute", left: -9999, width: 0, height: 0 }}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div style={fieldStyle}>
          <label htmlFor="email" style={labelStyle}>
            Work email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
            data-testid="auth-email"
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="full_name" style={labelStyle}>
            Full name *
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            placeholder="Priya Menon"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="input"
            data-testid="auth-fullname"
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="designation" style={labelStyle}>
            Designation
          </label>
          <input
            id="designation"
            name="designation"
            type="text"
            autoComplete="organization-title"
            placeholder="Chief Compliance Officer"
            value={form.designation || ""}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            className="input"
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="org_name" style={labelStyle}>
            Organisation
          </label>
          <input
            id="org_name"
            name="org_name"
            type="text"
            autoComplete="organization"
            placeholder="Axis Bank Ltd."
            value={form.org_name || ""}
            onChange={(e) => setForm({ ...form, org_name: e.target.value })}
            className="input"
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="org_type" style={labelStyle}>
            Organisation type
          </label>
          <select
            id="org_type"
            name="org_type"
            value={form.org_type || ""}
            onChange={(e) => setForm({ ...form, org_type: e.target.value })}
            className="input"
          >
            <option value="">Select type…</option>
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <div
            role="alert"
            data-testid="auth-error"
            style={{
              marginTop: 4,
              padding: "10px 12px",
              background: "var(--bad-bg)",
              color: "var(--bad)",
              fontSize: 12.5,
              borderRadius: "var(--radius-2)",
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || !form.email || !form.full_name}
          className="btn primary"
          data-testid="auth-submit"
          style={{ width: "100%", marginTop: 16, justifyContent: "center", padding: "10px 14px" }}
        >
          {mutation.isPending ? "Requesting code…" : "Request code"}
        </button>
      </form>

      <hr className="hr" style={{ margin: "20px 0 14px" }} />

      <p style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "center" }}>
        Already have an account?{" "}
        <Link
          href="/login"
          style={{ color: "var(--ink)", fontWeight: 500, borderBottom: "1px solid var(--signal)" }}
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
