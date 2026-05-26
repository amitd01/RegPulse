"use client";

import { cn } from "@/lib/cn";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  compact?: boolean;
  large?: boolean;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
  compact = false,
  large = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);
  const btnClass = large
    ? "rounded-lg px-3.5 py-2.5 text-[15px] font-semibold"
    : compact
      ? "rounded-md px-2 py-1 text-xs font-medium"
      : "rounded-md px-3 py-2 text-sm font-medium";
  const ellipsisClass = large
    ? "px-2 py-2.5 text-[15px] text-gray-400"
    : compact
      ? "px-1.5 py-1 text-xs text-gray-400"
      : "px-2 py-2 text-sm text-gray-400";

  return (
    <nav
      className={cn(
        "flex flex-wrap items-center gap-1",
        className ?? "justify-center",
      )}
      aria-label="Pagination"
    >
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={cn(
          btnClass,
          "text-[#4D6480] hover:bg-cream-200 disabled:cursor-not-allowed disabled:text-gray-400 disabled:opacity-100 dark:text-gray-400 dark:hover:bg-navy-700",
        )}
      >
        Previous
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className={ellipsisClass}>
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={cn(
              btnClass,
              p === page
                ? "bg-[#1A2B40] text-white dark:bg-navy-700"
                : "text-[#4D6480] hover:bg-cream-200 dark:text-gray-300 dark:hover:bg-navy-700",
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(
          btnClass,
          "text-[#4D6480] hover:bg-cream-200 disabled:cursor-not-allowed disabled:text-gray-400 disabled:opacity-100 dark:text-gray-400 dark:hover:bg-navy-700",
        )}
      >
        Next
      </button>
    </nav>
  );
}

/** Generate page number array with ellipsis. */
function getPageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
