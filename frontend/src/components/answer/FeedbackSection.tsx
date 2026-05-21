"use client";

import { useState } from "react";
import type { FeedbackCategory, FeedbackRecord } from "@/types";

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "INCORRECT_INTERPRETATION", label: "Incorrect Interpretation" },
  { value: "MISSING_CITATION",         label: "Missing Citation" },
  { value: "UI_ISSUE",                 label: "UI Issue" },
  { value: "COMPLIANCE_CONCERN",       label: "Compliance Concern" },
  { value: "OTHER",                    label: "Other" },
];

interface FeedbackSectionProps {
  onSubmit: (data: { comment: string; category: string; is_helpful: boolean }) => void;
  isSubmitting?: boolean;
  submitted?: boolean;
  existingFeedback?: FeedbackRecord | null;
}

export function FeedbackSection({
  onSubmit,
  isSubmitting = false,
  submitted = false,
  existingFeedback,
}: FeedbackSectionProps) {
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && isHelpful === null) return;
    onSubmit({
      comment: comment.trim(),
      category,
      is_helpful: isHelpful ?? true,
    });
  };

  if (submitted || existingFeedback != null) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="mb-1 flex justify-center">
          <svg className="h-6 w-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-sm font-semibold text-emerald-700">Feedback Submitted</div>
        <div className="mt-0.5 text-xs text-emerald-600">
          Thank you — your input helps us improve interpretation quality.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cream-300 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-cream-200 px-5 py-4">
        <h3 className="text-[13.5px] font-semibold text-[#1A2B40]">Share Your Feedback</h3>
        <p className="mt-0.5 text-[12px] text-[#7A95AD]">
          Help us improve by sharing your thoughts on this interpretation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        {/* Rating row */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Was this interpretation helpful?
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsHelpful(isHelpful === true ? null : true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isHelpful === true
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              Helpful
            </button>
            <button
              type="button"
              onClick={() => setIsHelpful(isHelpful === false ? null : false)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isHelpful === false
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <svg className="h-3.5 w-3.5 rotate-180" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              Not Helpful
            </button>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Category <span className="text-gray-400">(optional)</span>
          </label>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as FeedbackCategory | "")
            }
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-[13px] text-[#1A2B40] focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
          >
            <option value="">Select a category…</option>
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Your Comments
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your feedback regarding this interpretation…"
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-cream-300 bg-white px-3 py-2 text-[13px] text-[#1A2B40] placeholder-[#7A95AD] focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
          />
          <div className="mt-1 text-right text-xs text-gray-400">
            {comment.length}/2000
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={(!comment.trim() && isHelpful === null) || isSubmitting}
          className="w-full rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Submitting…" : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}
