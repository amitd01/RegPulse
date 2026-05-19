/**
 * Login page — work email input → OTP sent. v2 terminal-modern.
 *
 * Behaviour preserved verbatim from pre-rebuild: TanStack mutation against
 * loginUser; on success router.push('/verify?email=...&purpose=login').
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { type AxiosError } from "axios";
import { loginUser, type ApiError, type LoginRequest } from "@/lib/api/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const mutation = useMutation<unknown, AxiosError<ApiError>, LoginRequest>({
    mutationFn: loginUser,
    onSuccess: () => {
      const params = new URLSearchParams({ email, purpose: "login" });
      router.push(`/verify?${params.toString()}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ email });
  };

  const errorMsg = mutation.error?.response?.data?.error || mutation.error?.message;

  return (
    <>
      <div className="tick" style={{ marginBottom: 14 }}>
        SIGN IN · WORK EMAIL
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
        Welcome back.
      </h1>
      <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 24 }}>
        Enter your registered work email and we&apos;ll send a one-time code.
      </p>

      <form onSubmit={handleSubmit} aria-label="login-form">
        <label
          htmlFor="email"
          className="up"
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-4)",
            marginBottom: 6,
          }}
        >
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          data-testid="auth-email"
        />

        {errorMsg && (
          <div
            role="alert"
            data-testid="auth-error"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              border: "1px solid transparent",
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
          disabled={mutation.isPending || !email}
          className="btn primary"
          data-testid="auth-submit"
          style={{ width: "100%", marginTop: 20, justifyContent: "center", padding: "10px 14px" }}
        >
          {mutation.isPending ? "Requesting code…" : "Request code"}
        </button>
      </form>

      <hr className="hr" style={{ margin: "24px 0 16px" }} />

      <p
        style={{
          fontSize: 12.5,
          color: "var(--ink-3)",
          textAlign: "center",
        }}
      >
        New here?{" "}
        <Link
          href="/register"
          style={{
            color: "var(--ink)",
            fontWeight: 500,
            borderBottom: "1px solid var(--signal)",
          }}
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
