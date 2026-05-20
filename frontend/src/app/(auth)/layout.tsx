/**
 * Shared layout for auth pages (register, login, verify).
 * Blue & gold theme — cream background, grid overlay, branded card.
 */

import Link from "next/link";
import { RegPulseLogo } from "@/components/auth/RegPulseLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page-bg auth-page-grid relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <header className="absolute left-0 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-reg-border/80 bg-reg-bg/90 px-6 backdrop-blur-md sm:px-12">
        <RegPulseLogo href="/" size="sm" />
        <Link
          href="/register"
          className="rounded-[9px] bg-gradient-to-br from-reg-navy-btn-from to-reg-navy-btn-to px-5 py-2 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(15,28,46,0.18)] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(15,28,46,0.26)]"
        >
          Get Started
        </Link>
      </header>

      <div className="relative z-[1] w-full max-w-md pt-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-reg-gold/20 bg-reg-gold-bg px-4 py-1.5 text-[12px] font-medium uppercase tracking-wider text-reg-gold-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-reg-gold" />
            RBI Regulatory Intelligence
          </div>
          <p className="text-sm text-reg-text-sub">Secure access for compliance teams</p>
        </div>

        <div className="rounded-2xl border border-reg-border bg-white p-8 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
          {children}
        </div>
      </div>
    </div>
  );
}
