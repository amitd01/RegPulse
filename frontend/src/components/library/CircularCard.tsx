"use client";

import Link from "next/link";
import type { CircularListItem, CircularSearchResultItem } from "@/types";

interface CircularCardProps {
  circular: CircularListItem | CircularSearchResultItem;
}

function isSearchResult(
  c: CircularListItem | CircularSearchResultItem,
): c is CircularSearchResultItem {
  return "relevance_score" in c;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TAG_COLORS = [
  "bg-[#1B3A5C12] text-[#253B57] border-[#1B3A5C20]",
  "bg-cream-200 text-[#4D6480] border-cream-300",
  "bg-[#C9972E0A] text-gold-700 border-[#C9972E20]",
  "bg-[#1B3A5C08] text-[#4D6480] border-cream-300",
];

export function CircularCard({ circular }: CircularCardProps) {
  const issuedDate = formatDate(circular.issued_date);
  const indexedDate = formatDate(circular.indexed_at);

  const displayDate = issuedDate ?? indexedDate;
  const dateLabel = circular.issued_date ? "Issued" : "Indexed";

  const snippet = isSearchResult(circular) ? circular.snippet : null;
  const regulatorMap: Record<string, string> = {
    RBI: "Reserve Bank of India",
    SEBI: "Securities and Exchange Board of India",
    IRDAI: "Insurance Regulatory and Development Authority",
  };
  const regulatorLabel =
    (circular.regulator && regulatorMap[circular.regulator]) ||
    circular.regulator ||
    "Reserve Bank of India";

  const statusIsActive =
    circular.status === "ACTIVE" || circular.status === "Active";
  const statusLabel =
    circular.status === "ACTIVE"
      ? "Active"
      : circular.status.charAt(0) + circular.status.slice(1).toLowerCase();

  return (
    <div className="rounded-xl border border-cream-300 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:border-[#C9972E40] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-800">
      {/* Title */}
      <h3 className="text-[13.5px] font-semibold text-[#1A2B40] dark:text-gray-50">
        {circular.title}
      </h3>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#7A95AD] dark:text-gray-400">
        {/* Regulatory body */}
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
            />
          </svg>
          {regulatorLabel}
        </span>

        {/* Date */}
        {displayDate && (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
              />
            </svg>
            {dateLabel}: {displayDate}
          </span>
        )}

        {/* Status */}
        <span
          className={`flex items-center gap-1 font-medium ${
            statusIsActive
              ? "text-green-600 dark:text-green-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {statusIsActive ? (
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          )}
          {statusLabel}
        </span>

        {/* Relevance score for search results */}
        {isSearchResult(circular) && (
          <span className="text-navy-600 dark:text-navy-300">
            {(circular.relevance_score * 100).toFixed(1)}% match
          </span>
        )}
      </div>

      {/* Snippet / description */}
      {snippet ? (
        <p className="mt-3 text-sm leading-relaxed text-gray-700 line-clamp-2 dark:text-gray-300">
          {snippet}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {circular.doc_type.replace(/_/g, " ")}
          {circular.department ? ` · ${circular.department}` : ""}
          {circular.affected_teams && circular.affected_teams.length > 0
            ? ` · Affects: ${circular.affected_teams.slice(0, 3).join(", ")}`
            : ""}
        </p>
      )}

      {/* Tags */}
      {circular.tags && circular.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {circular.tags.slice(0, 5).map((tag, i) => (
            <span
              key={tag}
              className={`rounded border px-2 py-0.5 text-xs font-medium ${TAG_COLORS[i % TAG_COLORS.length]} dark:bg-opacity-20`}
            >
              {tag}
            </span>
          ))}
          {circular.tags.length > 5 && (
            <span className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-400">
              +{circular.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* View Document button */}
      <div className="mt-4">
        <Link
          href={`/library/${circular.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A5C25] bg-[#1B3A5C06] px-4 py-1.5 text-[13px] font-medium text-navy-800 transition-colors hover:border-navy-900 hover:bg-navy-900 hover:text-white dark:border-navy-600 dark:text-gray-300 dark:hover:bg-navy-700"
        >
          View Document
        </Link>
      </div>
    </div>
  );
}
