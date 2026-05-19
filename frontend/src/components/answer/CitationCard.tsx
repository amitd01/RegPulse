"use client";

import { useState } from "react";
import Link from "next/link";
import type { CitationItem } from "@/types";

interface CitationCardProps {
  citation: CitationItem;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Link to the library with the circular number as search query
  const librarySearchUrl = `/library?query=${encodeURIComponent(citation.circular_number)}`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Citation index badge */}
        <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-crimson-100 text-xs font-bold text-crimson-700">
          {index + 1}
        </div>

        {/* Circular reference */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {citation.circular_number}
            </span>
            {citation.section_reference && (
              <span className="text-xs text-gray-500 truncate">
                — {citation.section_reference}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={librarySearchUrl}
            className="inline-flex items-center gap-1 rounded-md border border-crimson-200 bg-crimson-50 px-2.5 py-1 text-xs font-medium text-crimson-700 hover:bg-crimson-100 transition-colors"
          >
            View Circular
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </Link>

          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse citation" : "Expand citation"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable verbatim quote */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-crimson-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            <blockquote className="text-sm italic leading-relaxed text-gray-600">
              &ldquo;{citation.verbatim_quote}&rdquo;
            </blockquote>
          </div>
        </div>
      )}
    </div>
  );
}
