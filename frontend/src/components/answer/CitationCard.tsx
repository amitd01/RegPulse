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
  const librarySearchUrl = `/library?query=${encodeURIComponent(citation.circular_number)}`;

  return (
    <div className="overflow-hidden rounded-xl border border-cream-300 bg-white shadow-sm transition-all hover:border-[#C9972E40] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] text-[11px] font-bold text-gold-400">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[#1A2B40]">
              {citation.circular_number}
            </span>
            {citation.section_reference && (
              <span className="truncate text-[11px] text-[#7A95AD]">
                — {citation.section_reference}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href={librarySearchUrl}
            className="inline-flex items-center gap-1 rounded-md border border-[#1B3A5C20] bg-[#1B3A5C08] px-2.5 py-1 text-[11px] font-medium text-navy-800 transition-colors hover:border-navy-900 hover:bg-navy-900 hover:text-white"
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
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse citation" : "Expand citation"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#7A95AD] transition-colors hover:bg-cream-200 hover:text-[#1A2B40]"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-cream-200 bg-cream-100 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-500"
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
            <blockquote className="text-[13px] italic leading-relaxed text-[#4D6480]">
              &ldquo;{citation.verbatim_quote}&rdquo;
            </blockquote>
          </div>
        </div>
      )}
    </div>
  );
}

