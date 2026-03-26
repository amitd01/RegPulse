"use client";

import Link from "next/link";
import { Badge, impactVariant, statusVariant } from "@/components/ui/Badge";
import type { CircularListItem, CircularSearchResultItem } from "@/types";

interface CircularCardProps {
  circular: CircularListItem | CircularSearchResultItem;
}

function isSearchResult(
  c: CircularListItem | CircularSearchResultItem,
): c is CircularSearchResultItem {
  return "relevance_score" in c;
}

export function CircularCard({ circular }: CircularCardProps) {
  const formattedDate = circular.issued_date
    ? new Date(circular.issued_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Link
      href={`/library/${circular.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {circular.circular_number && (
              <span className="text-xs font-semibold text-navy-600">
                {circular.circular_number}
              </span>
            )}
            <Badge variant={statusVariant(circular.status)}>
              {circular.status}
            </Badge>
            {circular.impact_level && (
              <Badge variant={impactVariant(circular.impact_level)}>
                {circular.impact_level}
              </Badge>
            )}
            <span className="text-xs text-gray-400">
              {circular.doc_type.replace(/_/g, " ")}
            </span>
          </div>

          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
            {circular.title}
          </h3>

          {isSearchResult(circular) && circular.snippet && (
            <p className="mt-2 text-xs text-gray-500 line-clamp-2">
              {circular.snippet}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {formattedDate && <span>{formattedDate}</span>}
            {circular.department && (
              <>
                <span className="text-gray-300">|</span>
                <span className="truncate">{circular.department}</span>
              </>
            )}
            {isSearchResult(circular) && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-navy-600">
                  Relevance: {(circular.relevance_score * 100).toFixed(1)}%
                </span>
              </>
            )}
          </div>

          {circular.tags && circular.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {circular.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="default">
                  {tag}
                </Badge>
              ))}
              {circular.tags.length > 4 && (
                <span className="text-xs text-gray-400">
                  +{circular.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
