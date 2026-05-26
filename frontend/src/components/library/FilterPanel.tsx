"use client";

import { cn } from "@/lib/cn";
import type { CircularFilters } from "@/types";

const DOC_TYPE_OPTIONS = [
  { value: "CIRCULAR", label: "Circular" },
  { value: "MASTER_DIRECTION", label: "Master Direction" },
  { value: "NOTIFICATION", label: "Notification" },
  { value: "PRESS_RELEASE", label: "Press Release" },
  { value: "GUIDELINE", label: "Guideline" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active Only" },
  { value: "SUPERSEDED", label: "Superseded" },
  { value: "DRAFT", label: "Draft" },
];

const DEPARTMENT_OPTIONS = [
  { value: "Department of Regulation", label: "Department of Regulation" },
  { value: "Department of Supervision", label: "Department of Supervision" },
  { value: "Foreign Exchange Department", label: "Foreign Exchange Dept." },
  { value: "Payment and Settlement Systems", label: "Payment & Settlement" },
];

const REGULATORY_BODY_OPTIONS = [
  { value: "RBI", label: "Reserve Bank of India" },
];

interface FilterPanelProps {
  filters: CircularFilters;
  onFilterChange: (key: keyof CircularFilters, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  className?: string;
}

const selectClass =
  "w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-[13px] text-[#1A2B40] shadow-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-200";

const fieldClass = "flex flex-col gap-1.5";

export function FilterPanel({
  filters,
  onFilterChange,
  onApply,
  onReset,
  className,
}: FilterPanelProps) {
  const hasActiveFilters =
    filters.doc_type ||
    filters.status ||
    filters.impact_level ||
    filters.department ||
    filters.date_from ||
    filters.date_to;

  return (
    <div
      className={cn(
        "w-full shrink-0 rounded-xl border border-cream-300 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-800",
        className,
      )}
    >
      <h3 className="mb-4 text-[14px] font-semibold text-[#1A2B40] dark:text-gray-100">
        Filter Documents
      </h3>

      <div className="flex flex-col gap-4">
        <div className={fieldClass}>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            Regulatory Body
          </label>
          <select className={selectClass} value="" onChange={() => {}}>
            <option value="">All Regulators</option>
            {REGULATORY_BODY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            Document Type
          </label>
          <select
            className={selectClass}
            value={filters.doc_type || ""}
            onChange={(e) => onFilterChange("doc_type", e.target.value)}
          >
            <option value="">All Types</option>
            {DOC_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            Department
          </label>
          <select
            className={selectClass}
            value={filters.department || ""}
            onChange={(e) => onFilterChange("department", e.target.value)}
          >
            <option value="">All Departments</option>
            {DEPARTMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            Status
          </label>
          <select
            className={selectClass}
            value={filters.status || ""}
            onChange={(e) => onFilterChange("status", e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onApply}
          className="w-full rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          Apply Filters
        </button>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="w-full rounded-lg border border-cream-300 px-4 py-2 text-[13px] font-medium text-[#4D6480] transition-colors hover:border-gold-500 hover:text-[#1A2B40] dark:border-navy-600 dark:text-gray-400"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
