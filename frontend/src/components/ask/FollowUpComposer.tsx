"use client";

import { useCallback, useRef } from "react";

interface FollowUpComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  creditBalance?: number | null;
  turnCount?: number;
}

export function FollowUpComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  isStreaming = false,
  creditBalance,
  turnCount = 1,
}: FollowUpComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && !isStreaming && value.trim().length >= 5) {
          onSubmit();
        }
      }
    },
    [disabled, isStreaming, onSubmit, value],
  );

  const canSend = !disabled && !isStreaming && value.trim().length >= 5;

  return (
    <div className="sticky bottom-0 z-10 -mx-8 border-t border-cream-300 bg-gradient-to-t from-cream-100 via-cream-100 to-cream-100/95 px-8 pb-6 pt-4 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        {turnCount > 1 && (
          <p className="mb-2 text-center text-[11px] text-[#7A95AD]">
            {turnCount} questions in this thread
            {creditBalance !== null && creditBalance !== undefined && (
              <>
                {" "}
                · <span className="font-medium text-gold-600">{creditBalance}</span> credits
                remaining
              </>
            )}
          </p>
        )}
        <div className="rounded-2xl border border-cream-300 bg-white shadow-[0_8px_32px_rgba(15,28,46,0.08)] ring-1 ring-black/[0.03]">
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#1E3050,#162236)]">
              <svg
                className="h-4 w-4 text-gold-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up — e.g. How does this apply to NBFCs with assets under ₹500 crore?"
              rows={2}
              maxLength={500}
              disabled={disabled || isStreaming}
              className="min-h-[52px] flex-1 resize-none border-none bg-transparent text-[14px] leading-relaxed text-[#1A2B40] placeholder-[#B0A898] focus:outline-none disabled:opacity-60"
            />
          </div>
          <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3">
            <span className="text-[11px] text-[#7A95AD]">
              {value.length} / 500 · 1 credit per follow-up
            </span>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              className="flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStreaming ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Thinking…
                </>
              ) : (
                <>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-500">
                    <svg
                      className="h-2.5 w-2.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 12h14M12 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                  Send follow-up
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
