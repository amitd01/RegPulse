"use client";

import { useState } from "react";

type TabFilter = "all" | "personal" | "team" | "needs_update";
type ItemStatus = "current" | "update_available";
type ItemScope = "personal" | "team";

interface DummySavedItem {
  id: string;
  title: string;
  savedDate: string;
  savedBy: string;
  scope: ItemScope;
  status: ItemStatus;
  description: string;
  tags: string[];
  comments?: number;
  updateNotice?: string;
}

const DUMMY_ITEMS: DummySavedItem[] = [
  {
    id: "1",
    title: "NRI Account Opening - Documentary Requirements",
    savedDate: "Nov 16, 2025",
    savedBy: "You",
    scope: "personal",
    status: "current",
    description:
      "Interpretation covering mandatory documentation for Non-Resident Indian savings accounts including enhanced due diligence requirements for high-value accounts.",
    tags: ["KYC", "NRI Banking", "Operations"],
  },
  {
    id: "2",
    title: "Digital Lending Guidelines - Platform Requirements",
    savedDate: "Nov 10, 2025",
    savedBy: "Team",
    scope: "team",
    status: "current",
    description:
      "Comprehensive analysis of RBI guidelines for digital lending including fair practices code, data privacy requirements, and third-party vendor management.",
    tags: ["Digital Lending", "Fintech", "Compliance"],
    comments: 3,
  },
  {
    id: "3",
    title: "Corporate KYC Verification Process",
    savedDate: "Oct 20, 2025",
    savedBy: "You",
    scope: "personal",
    status: "update_available",
    description:
      "Guidelines for corporate customer identification and verification. Includes beneficial ownership requirements and authorized signatory documentation.",
    tags: ["KYC", "Corporate Banking"],
    updateNotice: "Source regulation updated on Nov 15, 2025 — RBI Master Circular on KYC Norms has been amended. This interpretation may need review.",
  },
];

const TAB_COUNTS = {
  all: DUMMY_ITEMS.length,
  personal: DUMMY_ITEMS.filter((i) => i.scope === "personal").length,
  team: DUMMY_ITEMS.filter((i) => i.scope === "team").length,
  needs_update: DUMMY_ITEMS.filter((i) => i.status === "update_available").length,
};

export default function SavedPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = DUMMY_ITEMS.filter((item) => {
    if (activeTab === "personal" && item.scope !== "personal") return false;
    if (activeTab === "team" && item.scope !== "team") return false;
    if (activeTab === "needs_update" && item.status !== "update_available") return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: `All Items (${TAB_COUNTS.all})` },
    { key: "personal", label: `Personal (${TAB_COUNTS.personal})` },
    { key: "team", label: `Team Shared (${TAB_COUNTS.team})` },
    { key: "needs_update", label: `Needs Update (${TAB_COUNTS.needs_update})` },
  ];

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8">
        <h2 className="mb-6 font-serif text-[26px] text-[#1A2B40] dark:text-gray-100">Saved Interpretations</h2>

        {/* Search + Filter bar */}
        <div className="mb-5 flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved items..."
            className="flex-1 rounded-lg border border-cream-300 bg-white px-3 py-2 text-[13.5px] text-[#1A2B40] placeholder-[#7A95AD] shadow-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-200"
          />
          <button className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-[13.5px] font-medium text-[#4D6480] transition-colors hover:border-gold-500 hover:text-[#1A2B40]">
            Filter
          </button>
        </div>

        {/* Tab filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? "rounded-full bg-navy-900 px-4 py-1.5 text-[13px] font-medium text-white"
                  : "rounded-full border border-cream-300 bg-white px-4 py-1.5 text-[13px] font-medium text-[#4D6480] hover:border-gold-500 hover:text-[#1A2B40]"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cards */}
        {filtered.length === 0 && (
          <p className="py-20 text-center text-sm text-gray-500">No saved interpretations match your filters.</p>
        )}

        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-cream-300 bg-white p-5 shadow-sm transition hover:border-[#C9972E40] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-800"
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[13.5px] font-semibold text-[#1A2B40] dark:text-gray-100">{item.title}</h2>
                {item.status === "current" ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Current
                  </span>
                ) : (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    Update Available
                  </span>
                )}
              </div>

              {/* Meta row */}
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Saved: {item.savedDate}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Saved by: {item.savedBy}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.scope === "personal" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                  {item.scope === "personal" ? "Personal" : "Team Shared"}
                </span>
                {item.comments !== undefined && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {item.comments} comments
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{item.description}</p>

              {/* Update notice */}
              {item.updateNotice && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-900/20">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <p className="text-xs text-amber-700 dark:text-amber-300">{item.updateNotice}</p>
                </div>
              )}

              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.status === "update_available" ? (
                  <>
                    <button className="rounded-lg bg-[linear-gradient(135deg,#1B3A5C,#0F1C2E)] px-4 py-1.5 text-xs font-medium text-white transition hover:shadow-md">
                      Review Update
                    </button>
                    <button className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      View Original
                    </button>
                  </>
                ) : (
                  <>
                    <button className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      View
                    </button>
                    <button className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      Share
                    </button>
                    <button className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      Export
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
