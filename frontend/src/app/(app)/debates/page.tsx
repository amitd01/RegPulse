"use client";

import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useCreateDebate, useDebates } from "@/hooks/useCollaboration";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "RESOLVED", label: "Resolved" },
];

export default function DebatesPage() {
  const [page] = useState(1);
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useDebates(page, status || undefined);
  const createDebate = useCreateDebate();

  const handleCreate = () => {
    if (!title.trim() || !description.trim()) return;
    createDebate.mutate(
      { title: title.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">Team Debates</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Discuss regulatory interpretations and record official decisions
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-2 text-sm font-semibold text-white hover:shadow-md"
          >
            {showForm ? "Cancel" : "Start Debate"}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-1 border-b border-cream-300 dark:border-navy-700">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key)}
              className={`relative -mb-px px-4 pb-3 pt-2 text-[13.5px] font-medium ${
                status === tab.key
                  ? "border-b-2 border-navy-900 text-[#1A2B40] dark:border-gold-400 dark:text-gold-400"
                  : "text-[#7A95AD] hover:text-[#1A2B40]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border border-cream-300 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
            <h3 className="mb-3 text-sm font-semibold text-[#1A2B40] dark:text-white">New Debate</h3>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Debate topic"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the regulatory question under debate"
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-900 dark:text-white"
              />
              <button
                type="button"
                disabled={createDebate.isPending}
                onClick={handleCreate}
                className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-900 disabled:opacity-50"
              >
                {createDebate.isPending ? "Creating…" : "Create Debate"}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && (data?.data.length ?? 0) === 0 && (
          <div className="py-20 text-center text-sm text-gray-500">
            No debates yet. Start one to discuss an interpretation with your team.
          </div>
        )}

        {!isLoading && (data?.data.length ?? 0) > 0 && (
          <div className="space-y-4">
            {data!.data.map((debate) => (
              <Link
                key={debate.id}
                href={`/debates/${debate.id}`}
                className="block rounded-xl border border-cream-300 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-navy-700 dark:bg-navy-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          debate.status === "RESOLVED"
                            ? "bg-green-50 text-green-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {debate.status}
                      </span>
                      <h3 className="text-[15px] font-semibold text-[#1A2B40] dark:text-white">
                        {debate.title}
                      </h3>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                      {debate.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
                      {debate.creator && <span>{debate.creator.full_name}</span>}
                      <span>{debate.reply_count} replies</span>
                      <span className="text-green-600">{debate.agree_count} agree</span>
                      <span className="text-red-500">{debate.disagree_count} disagree</span>
                    </div>
                  </div>
                  <svg className="h-5 w-5 shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
