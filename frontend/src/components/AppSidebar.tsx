"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useEffect, useState } from "react";

function useUpdatesUnreadCount(enabled: boolean) {
  return useQuery<{ unread_count: number }>({
    queryKey: ["circulars", "updates-badge"],
    queryFn: async () => {
      const { data } = await api.get("/circulars/updates", {
        params: { page: 1, page_size: 1 },
      });
      return { unread_count: data.unread_count ?? 0 };
    },
    staleTime: 60_000,
    enabled,
  });
}

function useActionItemsCount(enabled: boolean) {
  return useQuery<{ total: number }>({
    queryKey: ["action-items-badge"],
    queryFn: async () => {
      const { data } = await api.get("/action-items/stats");
      const open = (data.pending ?? 0) + (data.in_progress ?? 0);
      return { total: open };
    },
    staleTime: 60_000,
    enabled,
  });
}

const WORKSPACE_NAV = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8} />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8} />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8} />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.8} />
      </svg>
    ),
  },
  {
    name: "Ask RegPulse",
    href: "/ask",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" strokeWidth={1.8} />
        <path d="m21 21-4.35-4.35" strokeWidth={1.8} />
      </svg>
    ),
  },
  {
    name: "Document Repository",
    href: "/library",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
        />
      </svg>
    ),
  },
  {
    name: "History",
    href: "/history",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
        />
      </svg>
    ),
  },
];

const MONITOR_NAV = [
  {
    name: "Updates",
    href: "/updates",
    badge: "updates",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
        />
      </svg>
    ),
  },
  {
    name: "Action Items",
    href: "/action-items",
    badge: "actions",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"
        />
      </svg>
    ),
  },
  {
    name: "Saved Interpretations",
    href: "/saved",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    ),
  },
];

const TEAM_NAV = [
  {
    name: "Team Learnings",
    href: "/learnings",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
  {
    name: "Debates",
    href: "/debates",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4z"
        />
      </svg>
    ),
  },
];

function NavItem({
  item,
  isActive,
  badge,
}: {
  item: { name: string; href: string; icon: React.ReactNode };
  isActive: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-all duration-150",
        isActive
          ? "border border-[rgba(201,151,46,0.18)] bg-[rgba(201,151,46,0.1)] font-medium text-white"
          : "font-normal text-[#5A7E9E] hover:bg-[#1E3050] hover:text-[#C0D4E8]",
      )}
    >
      {/* Gold left-bar indicator for active */}
      <span
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-gold-500 transition-all duration-150",
          isActive ? "h-8 opacity-100" : "h-0 opacity-0",
        )}
      />
      <span className={cn("flex-shrink-0", isActive ? "opacity-100" : "opacity-75")}>
        {item.icon}
      </span>
      <span className="flex-1">{item.name}</span>
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-navy-900">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function ThemeToggleInline() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-9" />;

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#7A95AD] transition-colors hover:bg-navy-700 hover:text-[#D0DFF0]"
    >
      <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
      <span className="relative ml-auto inline-flex h-4.5 w-9 items-center rounded-full bg-navy-600 transition-colors">
        <span
          className={cn(
            "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
            isDark ? "translate-x-5" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { data: badge } = useUpdatesUnreadCount(!!user);
  const { data: actionBadge } = useActionItemsCount(!!user);
  const unread = badge?.unread_count ?? 0;
  const actionCount = actionBadge?.total ?? 0;

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const creditBalance = user?.credit_balance ?? 0;
  const creditPct = Math.min(100, Math.round((creditBalance / 500) * 100));

  return (
    <aside
      className="flex h-screen w-[304px] flex-shrink-0 flex-col shadow-[6px_0_32px_rgba(0,0,0,0.28)]"
      style={{ background: "#0F1C2E" }}
    >
      {/* Logo */}
      <div className="border-b border-[#253B57] px-[26px] pb-[22px] pt-7">
        <Link href="/dashboard" className="block">
          <div className="font-serif text-[26px] leading-none tracking-wide text-white">
            Reg<span className="text-gold-400">Pulse</span>
          </div>
          <div className="mt-[5px] text-[9px] font-semibold uppercase tracking-[0.22em] text-[#3E5F7C]">
            Compliance Intelligence
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sidebar-no-scrollbar flex-1 overflow-y-auto px-[14px] py-[22px]">
        {/* Workspace section */}
        <div className="mb-[7px] px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#2F4A62]">
          Workspace
        </div>
        <div className="space-y-0.5">
          {WORKSPACE_NAV.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
            />
          ))}
        </div>

        {/* Monitor section */}
        <div className="mb-[7px] mt-[18px] px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#2F4A62]">
          Monitor
        </div>
        <div className="space-y-0.5">
          {MONITOR_NAV.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
              badge={
                item.badge === "updates"
                  ? unread
                  : item.badge === "actions"
                    ? actionCount
                    : undefined
              }
            />
          ))}
        </div>

        {/* Team section */}
        <div className="mb-[7px] mt-[18px] px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#2F4A62]">
          Team
        </div>
        <div className="space-y-0.5">
          {TEAM_NAV.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-[#253B57] px-4 pb-5 pt-[14px]">
        {/* Credits bar */}
        {user && (
          <div className="mb-3 rounded-[10px] border border-[#253B57] bg-[#182840] px-[14px] py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#2F4A62]">
                Credits
              </span>
              <span className="text-[12px] font-semibold text-gold-400">
                {creditBalance}
              </span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-[width] duration-500"
                style={{ width: `${creditPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Theme toggle */}
        <ThemeToggleInline />

        {/* User card */}
        {user && (
          <div className="mt-2 flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-600 to-gold-500 text-[13px] font-bold text-navy-900">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-[#C8D8E8]">
                {user.full_name}
              </div>
              <div className="truncate text-[10.5px] text-[#7A95AD]">{user.email}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
