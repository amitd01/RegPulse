/**
 * OTP verification — v2 terminal-modern.
 *
 * Behaviour preserved: 6 boxes, auto-advance, auto-submit on last digit,
 * Suspense wrapper for useSearchParams. On success setAuth(user, accessToken)
 * then router.push('/dashboard').
 */

"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { type AxiosError } from "axios";
import {
  verifyOtp,
  type ApiError,
  type AuthResponse,
  type OTPVerifyRequest,
} from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import OTPInput from "@/components/OTPInput";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const email = searchParams.get("email") || "";
  const purpose = (searchParams.get("purpose") || "login") as "register" | "login";

  const [otp, setOtp] = useState("");

  const mutation = useMutation<AuthResponse, AxiosError<ApiError>, OTPVerifyRequest>({
    mutationFn: verifyOtp,
    onSuccess: (data) => {
      setAuth(data.user, data.tokens.access_token);
      router.push("/dashboard");
    },
  });

  const handleComplete = useCallback(
    (completedOtp: string) => {
      if (mutation.isPending) return;
      mutation.mutate({ email, otp: completedOtp, purpose });
    },
    [email, purpose, mutation],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 6) handleComplete(otp);
  };

  const errorMsg = mutation.error?.response?.data?.error || mutation.error?.message;

  // a***@domain.com
  const maskedEmail = email
    ? `${email[0]}${"*".repeat(Math.max(0, email.indexOf("@") - 1))}${email.slice(email.indexOf("@"))}`
    : "";

  return (
    <>
      <div className="tick" style={{ marginBottom: 14 }}>
        VERIFY · 6-DIGIT CODE
      </div>

      <h1
        className="serif"
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
          marginBottom: 8,
        }}
      >
        Confirm your terminal.
      </h1>
      <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 24 }}>
        We sent a code to{" "}
        <span
          className="mono"
          style={{ color: "var(--ink)", background: "var(--panel-2)", padding: "1px 6px" }}
          data-testid="auth-masked-email"
        >
          {maskedEmail}
        </span>
        . Enter it below — paste works too.
      </p>

      <form onSubmit={handleSubmit} aria-label="verify-form">
        <OTPInput
          value={otp}
          onChange={setOtp}
          onComplete={handleComplete}
          disabled={mutation.isPending}
        />

        {errorMsg && (
          <div
            role="alert"
            data-testid="auth-error"
            style={{
              marginTop: 18,
              padding: "10px 12px",
              background: "var(--bad-bg)",
              color: "var(--bad)",
              fontSize: 12.5,
              borderRadius: "var(--radius-2)",
              textAlign: "center",
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || otp.length < 6}
          className="btn primary"
          data-testid="auth-verify-submit"
          style={{ width: "100%", marginTop: 22, justifyContent: "center", padding: "10px 14px" }}
        >
          {mutation.isPending ? "Verifying…" : "Verify"}
        </button>
      </form>

      <hr className="hr" style={{ margin: "20px 0 14px" }} />

      <p style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "center" }}>
        Didn&apos;t receive the code?{" "}
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            color: "var(--ink)",
            fontWeight: 500,
            borderBottom: "1px solid var(--signal)",
            background: "none",
            border: 0,
            borderBottomWidth: 1,
            borderBottomStyle: "solid",
            borderBottomColor: "var(--signal)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Send again
        </button>
      </p>
    </>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          className="tick"
          style={{
            textAlign: "center",
            padding: "32px 0",
            color: "var(--ink-4)",
          }}
        >
          LOADING…
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
