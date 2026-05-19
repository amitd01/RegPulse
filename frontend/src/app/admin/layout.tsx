/**
 * Admin shell — v2 terminal-modern (S7a).
 *
 * Permanent left rail with nav items rendered as .tick-style labels.
 * No `bg-navy-*` / `text-navy-*` / `slate-*` / `bg-gray-*` classes (rule 15).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNav = [
  { name: "Dashboard", href: "/admin", code: "DASH" },
  { name: "Review", href: "/admin/review", code: "REV" },
  { name: "Prompts", href: "/admin/prompts", code: "PRM" },
  { name: "Users", href: "/admin/users", code: "USR" },
  { name: "Circulars", href: "/admin/circulars", code: "CIR" },
  { name: "Scraper", href: "/admin/scraper", code: "SCR" },
  { name: "Uploads", href: "/admin/uploads", code: "UPL" },
  { name: "Heatmap", href: "/admin/heatmap", code: "HTM" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="gridlines"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Side rail */}
      <aside
        style={{
          width: 224,
          borderRight: "1px solid var(--line)",
          background: "var(--panel)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 18px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <Link
            href="/admin"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
            data-testid="admin-brand"
          >
            <span
              className="mono"
              style={{
                width: 26,
                height: 26,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--signal)",
                color: "#fff",
                borderRadius: 2,
                fontWeight: 700,
                fontSize: 11.5,
              }}
            >
              AD
            </span>
            <span
              className="serif"
              style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}
            >
              Admin
            </span>
          </Link>
          <span style={{ flex: 1 }} />
          <Link
            href="/dashboard"
            className="mono up"
            style={{
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: ".05em",
            }}
          >
            Exit
          </Link>
        </div>

        <nav style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          {adminNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`admin-nav-${item.code.toLowerCase()}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? "var(--ink)" : "var(--ink-3)",
                  background: active ? "var(--panel-2)" : "transparent",
                  borderLeft: `2px solid ${active ? "var(--signal)" : "transparent"}`,
                  textDecoration: "none",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 9.5, color: "var(--ink-4)", letterSpacing: ".06em" }}
                >
                  {item.code}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <span style={{ flex: 1 }} />

        <div
          className="mono up"
          style={{
            padding: "12px 18px",
            fontSize: 9.5,
            color: "var(--ink-4)",
            letterSpacing: ".08em",
            borderTop: "1px solid var(--line)",
          }}
        >
          ADMIN · v2
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto" }} data-testid="admin-main">
        {children}
      </main>
    </div>
  );
}
