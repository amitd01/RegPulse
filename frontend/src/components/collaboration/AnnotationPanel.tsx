"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  usePostAnnotationReply,
  type Annotation,
} from "@/hooks/useCollaboration";
import { useAuthStore } from "@/stores/authStore";

interface AnnotationPanelProps {
  questionId: string;
  answerText: string;
}

function applyHighlights(text: string, annotations: Annotation[]): React.ReactNode {
  if (!text || annotations.length === 0) return text;

  const sorted = [...annotations].sort((a, b) => a.start_offset - b.start_offset);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  sorted.forEach((ann, idx) => {
    const start = Math.max(0, Math.min(ann.start_offset, text.length));
    const end = Math.max(start, Math.min(ann.end_offset, text.length));
    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }
    parts.push(
      <mark
        key={ann.id}
        id={`ann-${ann.id}`}
        className="rounded bg-yellow-200/80 px-0.5 dark:bg-yellow-500/30"
        title={ann.note ?? ann.selected_text}
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
    if (idx === sorted.length - 1 && cursor < text.length) {
      parts.push(text.slice(cursor));
    }
  });

  if (cursor === 0) return text;
  return parts;
}

function AnnotationCard({
  annotation,
  questionId,
  canDelete,
  onDelete,
}: {
  annotation: Annotation;
  questionId: string;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const postReply = usePostAnnotationReply(annotation.id, questionId);

  return (
    <div className="rounded-lg border border-cream-300 bg-cream-50 p-3 dark:border-navy-600 dark:bg-navy-900/50">
      <blockquote className="border-l-2 border-gold-400 pl-2 text-xs italic text-gray-600 dark:text-gray-300">
        &ldquo;{annotation.selected_text}&rdquo;
      </blockquote>
      {annotation.note && (
        <p className="mt-2 text-sm text-[#1A2B40] dark:text-gray-200">{annotation.note}</p>
      )}
      <div className="mt-1 text-[10px] text-gray-400">
        {annotation.author?.full_name} ·{" "}
        {new Date(annotation.created_at).toLocaleDateString("en-IN")}
      </div>

      {annotation.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-cream-200 pt-2 dark:border-navy-700">
          {annotation.replies.map((r) => (
            <div key={r.id} className="text-xs text-gray-600 dark:text-gray-300">
              <span className="font-medium">{r.author?.full_name}:</span> {r.content}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Reply to team…"
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs dark:border-navy-600 dark:bg-navy-900 dark:text-white"
        />
        <button
          type="button"
          disabled={!replyText.trim() || postReply.isPending}
          onClick={() =>
            postReply.mutate(replyText.trim(), { onSuccess: () => setReplyText("") })
          }
          className="shrink-0 rounded bg-navy-800 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
        >
          Reply
        </button>
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(annotation.id)}
          className="mt-2 text-[10px] text-red-500 hover:underline"
        >
          Delete
        </button>
      )}
    </div>
  );
}

export function AnnotationPanel({ questionId, answerText }: AnnotationPanelProps) {
  const user = useAuthStore((s) => s.user);
  const answerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useAnnotations(questionId);
  const createAnnotation = useCreateAnnotation();
  const deleteAnnotation = useDeleteAnnotation(questionId);

  const [note, setNote] = useState("");
  const [pendingSelection, setPendingSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);

  const annotations = data?.data ?? [];

  const plainText = useMemo(() => answerText.replace(/\*\*|__|#+\s|>\s|-\s|\d+\.\s/g, ""), [answerText]);

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !answerRef.current) return;

    const selectedText = sel.toString().trim();
    if (!selectedText) return;

    const range = sel.getRangeAt(0);
    if (!answerRef.current.contains(range.commonAncestorContainer)) return;

    const preRange = document.createRange();
    preRange.selectNodeContents(answerRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const end = start + selectedText.length;

    setPendingSelection({ text: selectedText, start, end });
    setNote("");
  }, []);

  const handleSave = () => {
    if (!pendingSelection) return;
    createAnnotation.mutate(
      {
        question_id: questionId,
        selected_text: pendingSelection.text,
        note: note.trim() || undefined,
        start_offset: pendingSelection.start,
        end_offset: pendingSelection.end,
        anchor_path: ["detailed-interpretation"],
      },
      { onSuccess: () => setPendingSelection(null) },
    );
  };

  const canDelete = (ann: Annotation) =>
    !!user && (ann.user_id === user.id || user.is_admin);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-cream-300 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-800">
        <div className="border-b border-cream-200 px-5 py-4 dark:border-navy-700">
          <h3 className="text-[13.5px] font-semibold text-[#1A2B40] dark:text-white">
            Detailed Interpretation
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">Select text to add a team annotation</p>
        </div>
        <div
          ref={answerRef}
          onMouseUp={handleTextSelect}
          className="prose prose-sm max-w-none px-5 py-4 prose-p:text-[#4D6480] dark:prose-invert"
        >
          {answerText ? (
            <>
              <ReactMarkdown>{answerText}</ReactMarkdown>
              {annotations.length > 0 && (
                <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                  {applyHighlights(plainText, annotations)}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No answer text available.</p>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        {pendingSelection && (
          <div className="rounded-xl border border-gold-300 bg-gold-50 p-4 dark:border-gold-700 dark:bg-gold-900/20">
            <div className="text-xs font-semibold uppercase text-gold-700 dark:text-gold-400">
              New Annotation
            </div>
            <blockquote className="mt-2 border-l-2 border-gold-400 pl-2 text-xs italic">
              &ldquo;{pendingSelection.text}&rdquo;
            </blockquote>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for your team…"
              rows={3}
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={createAnnotation.isPending}
                onClick={handleSave}
                className="rounded bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-900 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setPendingSelection(null)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-cream-300 bg-white dark:border-navy-700 dark:bg-navy-800">
          <div className="border-b border-cream-200 px-4 py-3 dark:border-navy-700">
            <h3 className="text-sm font-semibold text-[#1A2B40] dark:text-white">
              Team Annotations ({annotations.length})
            </h3>
          </div>
          <div className="max-h-[480px] space-y-3 overflow-y-auto p-4">
            {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
            {!isLoading && annotations.length === 0 && (
              <p className="text-xs text-gray-400">
                No annotations yet. Highlight text in the answer to start a discussion.
              </p>
            )}
            {annotations.map((ann) => (
              <AnnotationCard
                key={ann.id}
                annotation={ann}
                questionId={questionId}
                canDelete={canDelete(ann)}
                onDelete={(id) => deleteAnnotation.mutate(id)}
              />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
