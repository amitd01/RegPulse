/**
 * Login page — email input → OTP sent.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { loginUser, type LoginRequest } from "@/lib/api/auth";
import { type AxiosError } from "axios";
import type { ApiError } from "@/lib/api/auth";
import Link from "next/link";
import {
  authErrorClass,
  authHeadingClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryBtnClass,
  authSubheadingClass,
} from "@/components/auth/authStyles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const mutation = useMutation<unknown, AxiosError<ApiError>, LoginRequest>({
    mutationFn: loginUser,
    onSuccess: () => {
      const params = new URLSearchParams({
        email,
        purpose: "login",
      });
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
      <h2 className={`${authHeadingClass} mb-2 text-center`}>
        Welcome <span className="text-reg-gold">back</span>
      </h2>
      <p className={`${authSubheadingClass} mb-8 text-center`}>
        Enter your work email and we&apos;ll send a one-time code to sign in.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className={authLabelClass}>
            Work Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>

        {errorMsg && <div className={authErrorClass}>{errorMsg}</div>}

        <button type="submit" disabled={mutation.isPending} className={authPrimaryBtnClass}>
          {mutation.isPending ? "Sending OTP..." : "Send OTP"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-reg-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className={authLinkClass}>
          Register
        </Link>
      </p>
    </>
  );
}
