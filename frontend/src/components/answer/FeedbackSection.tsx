"use client";

import { useState } from "react";

const FEEDBACK_CATEGORIES = [
  "Incorrect Interpretation",
  "Missing Citation",
  "UI Issue",
  "Compliance Concern",
  "Other",
] as const;

interface FeedbackSectionProps {
  onSubmit: (data: { comment: string; category: string; feedback: number }) => void;
  isSubmitting?: boolean;
  submitted?: boolean;
  existingFeedback?: number | null;
}

export function FeedbackSection({
  onSubmit,
  isSubmitting = false,
  submitted = false,
  existingFeedback,
}: FeedbackSectionProps) {
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState<1 | -1 | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && rating === null) return;
    onSubmit({
      comment: comment.trim(),
      category,
      feedback: rating ?? 1,
    });
  };

  if (submitted || (existingFeedback !== null && existingFeedback !== undefined)) {
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Share Your Feedback</h3>
        <p className="mt-0.5 text-xs text-gray-500">
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
              onClick={() => setRating(rating === 1 ? null : 1)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                rating === 1
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
              onClick={() => setRating(rating === -1 ? null : -1)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                rating === -1
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
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500"
          >
            <option value="">Select a category…</option>
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
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
            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500"
          />
          <div className="mt-1 text-right text-xs text-gray-400">
            {comment.length}/2000
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={(!comment.trim() && rating === null) || isSubmitting}
          className="w-full rounded-lg bg-crimson-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-crimson-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Submitting…" : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}
