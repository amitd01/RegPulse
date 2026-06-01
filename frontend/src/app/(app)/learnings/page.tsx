"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import {
  useCreateLearning,
  useDeleteLearning,
  useLearningStats,
  useLearnings,
  usePinLearning,
  type TeamLearning,
} from "@/hooks/useCollaboration";
import { useAuthStore } from "@/stores/authStore";

function TagChip({ tag }: { tag: string }) {
  return (
    <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-medium text-gold-700 dark:bg-gold-900/30 dark:text-gold-300">
      {tag}
    </span>
  );
}

function LearningCard({
  item,
  canModify,
  onPin,
  onDelete,
  pinning,
  deleting,
}: {
  item: TeamLearning;
  canModify: boolean;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  pinning: boolean;
  deleting: boolean;
}) {
  return (
    <article
      className={`rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-navy-800 ${
        item.is_pinned
          ? "border-gold-400 border-l-4 dark:border-gold-500"
          : "border-cream-300 dark:border-navy-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.is_pinned && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gold-600">
                Pinned
              </span>
            )}
            <h3 className="text-[15px] font-semibold text-[#1A2B40] dark:text-white">{item.title}</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#4D6480] dark:text-gray-300">{item.note}</p>
          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
            {item.author && <span>{item.author.full_name}</span>}
            {item.source_question_id && (
              <Link
                href={`/history/${item.source_question_id}`}
                className="font-medium text-crimson-600 hover:underline"
              >
                View source Q&amp;A
              </Link>
            )}
            <span>
              {new Date(item.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        {canModify && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              type="button"
              disabled={pinning}
              onClick={() => onPin(item.id, !item.is_pinned)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-600 dark:text-gray-300"
            >
              {item.is_pinned ? "Unpin" : "Pin"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => onDelete(item.id)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function LearningsPage() {
  const user = useAuthStore((s) => s.user);
  const [page] = useState(1);
  const [tagFilter, setTagFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const { data, isLoading } = useLearnings(page, tagFilter || undefined);
  const { data: stats } = useLearningStats();
  const createLearning = useCreateLearning();
  const pinLearning = usePinLearning();
  const deleteLearning = useDeleteLearning();

  const allTags = useMemo(() => {
    if (!stats?.top_tags) return [];
    return stats.top_tags.map((t) => String(t.tag));
  }, [stats]);

  const handleCreate = () => {
    if (!title.trim() || !note.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    createLearning.mutate(
      { title: title.trim(), note: note.trim(), tags },
      {
        onSuccess: () => {
          setTitle("");
          setNote("");
          setTagsInput("");
          setShowForm(false);
        },
      },
    );
  };

  const canModify = (item: TeamLearning) =>
    !!user && (item.user_id === user.id || user.is_admin);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">Team Learnings</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Shared knowledge notes visible to everyone at your organization
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-2 text-sm font-semibold text-white hover:shadow-md"
          >
            {showForm ? "Cancel" : "Add Learning"}
          </button>
        </div>

        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total", value: stats.total },
              { label: "This Week", value: stats.this_week },
              { label: "Contributors", value: stats.unique_contributors },
              { label: "Pinned", value: stats.pinned_count },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-cream-300 bg-white px-4 py-3 dark:border-navy-700 dark:bg-navy-800"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-bold text-[#1A2B40] dark:text-white">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="mb-6 rounded-xl border border-cream-300 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
            <h3 className="mb-3 text-sm font-semibold text-[#1A2B40] dark:text-white">New Learning</h3>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did your team learn?"
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
              />
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (comma-separated, e.g. LCR, liquidity)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
              />
              <button
                type="button"
                disabled={createLearning.isPending}
                onClick={handleCreate}
                className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-900 disabled:opacity-50"
              >
                {createLearning.isPending ? "Saving…" : "Save Learning"}
              </button>
            </div>
          </div>
        )}

        {allTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTagFilter("")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                !tagFilter ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag === tagFilter ? "" : tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  tagFilter === tag ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && (data?.data.length ?? 0) === 0 && (
          <div className="py-20 text-center text-sm text-gray-500">
            No learnings yet. Be the first to share something with your team.
          </div>
        )}

        {!isLoading && (data?.data.length ?? 0) > 0 && (
          <div className="space-y-4">
            {data!.data.map((item) => (
              <LearningCard
                key={item.id}
                item={item}
                canModify={canModify(item)}
                onPin={(id, pinned) => pinLearning.mutate({ id, pinned })}
                onDelete={(id) => deleteLearning.mutate(id)}
                pinning={pinLearning.isPending}
                deleting={deleteLearning.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
