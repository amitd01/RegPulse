"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCreateLearning } from "@/hooks/useCollaboration";

interface SaveToTeamLearningDialogProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  defaultTitle?: string;
  defaultNote?: string;
}

export function SaveToTeamLearningDialog({
  open,
  onClose,
  questionId,
  defaultTitle = "",
  defaultNote = "",
}: SaveToTeamLearningDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [note, setNote] = useState(defaultNote);
  const [tagsInput, setTagsInput] = useState("");
  const [saved, setSaved] = useState(false);

  const createLearning = useCreateLearning();

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setNote(defaultNote);
      setTagsInput("");
      setSaved(false);
    }
  }, [open, defaultTitle, defaultNote]);

  if (!open) return null;

  const handleSave = () => {
    if (!title.trim() || !note.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createLearning.mutate(
      {
        title: title.trim(),
        note: note.trim(),
        tags,
        source_question_id: questionId,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => {
            setSaved(false);
            onClose();
          }, 1500);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-cream-300 bg-white p-6 shadow-xl dark:border-navy-700 dark:bg-navy-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-learning-title"
      >
        <h2 id="save-learning-title" className="text-lg font-semibold text-[#1A2B40] dark:text-white">
          Save to Team Learnings
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Share this insight with your organization. It will be linked to this Q&amp;A answer.
        </p>

        {saved ? (
          <div className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            Saved! Your team can view it on{" "}
            <Link href="/learnings" className="font-semibold underline">
              Team Learnings
            </Link>
            .
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Learning title"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What should your team remember from this answer?"
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            />
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 dark:border-navy-600 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createLearning.isPending || !title.trim() || !note.trim()}
                onClick={handleSave}
                className="rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {createLearning.isPending ? "Saving…" : "Save Learning"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
