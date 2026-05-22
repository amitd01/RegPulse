"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";

// Per-route metadata: icon SVG path, label, description
const ROUTE_META: Record<
  string,
  { label: string; desc: string; iconPath: string }
> = {
  "/ask": {
    label: "Ask RegPulse",
    desc: "RBI Circular Interpretation Engine",
    iconPath: '<circle cx="11" cy="11" r="8" stroke-width="2"/><path d="m21 21-4.35-4.35" stroke-width="2"/>',
  },
  "/library": {
    label: "Document Repository",
    desc: "Indexed RBI Circulars & Master Directions",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>',
  },
  "/history": {
    label: "Query History",
    desc: "Your past interpretations & questions",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
  },
  "/updates": {
    label: "Regulatory Updates",
    desc: "Latest RBI circulars & notifications",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/>',
  },
  "/action-items": {
    label: "Action Items",
    desc: "Compliance tasks & deadlines",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"/>',
  },
  "/saved": {
    label: "Saved Interpretations",
    desc: "Bookmarked regulatory answers",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z"/>',
  },
  "/account": {
    label: "Account",
    desc: "Manage your subscription",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0"/>',
  },
  "/upgrade": {
    label: "Upgrade Plan",
    desc: "Choose the right plan for your needs",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
  },
  "/dashboard": {
    label: "Dashboard",
    desc: "Your regulatory intelligence overview",
    iconPath:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0 1 15.75 3.75H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25z"/>',
  },
};

function getRouteMeta(pathname: string) {
  for (const [key, val] of Object.entries(ROUTE_META)) {
    if (pathname === key || pathname.startsWith(key + "/")) return val;
  }
  return {
    label: "RegPulse",
    desc: "Compliance Intelligence",
    iconPath: '<circle cx="11" cy="11" r="8" stroke-width="2"/><path d="m21 21-4.35-4.35" stroke-width="2"/>',
  };
}

export function TopBar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const { label, desc, iconPath } = getRouteMeta(pathname);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
    }
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-[#E2DDD5] bg-white px-8 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-900">
      {/* Left: section icon + label + description */}
      <div className="flex items-center gap-3">
        {/* Gold-tinted icon badge */}
        <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] border border-[#C9972E30] bg-[linear-gradient(135deg,rgba(201,151,46,0.09),rgba(201,151,46,0.06))]">
          <svg
            className="h-[15px] w-[15px] text-gold-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            dangerouslySetInnerHTML={{ __html: iconPath }}
          />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[#1A2B40] dark:text-gray-100">
            {label}
          </div>
          <div className="text-[12px] text-[#7A95AD]">{desc}</div>
        </div>
      </div>

      {/* Right: pills */}
      <div className="ml-auto flex items-center gap-3">
        {/* User pill */}
        {user && (
          <Link
            href="/account"
            className="flex items-center gap-1.5 rounded-full border border-[#DDD7CC] bg-cream-100 px-3 py-1.5 text-[12px] text-[#4D6480] transition-colors hover:border-gold-500 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-300"
          >
            <svg className="h-[13px] w-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" strokeWidth={1.8} />
              <path d="M20 21a8 8 0 1 0-16 0" strokeWidth={1.8} />
            </svg>
            <span className="hidden sm:inline">
              {user.full_name?.split(" ")[0]} {initials.slice(-1)}.
            </span>
          </Link>
        )}

        {/* Logout */}
        {user && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-full border border-[#DDD7CC] bg-cream-100 px-3 py-1.5 text-[12px] text-[#4D6480] transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-50 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-300 dark:hover:border-red-500 dark:hover:text-red-400"
            aria-label="Log out"
          >
            <svg className="h-[13px] w-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
              />
            </svg>
            <span className="hidden sm:inline">{loggingOut ? "Logging out…" : "Log out"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
