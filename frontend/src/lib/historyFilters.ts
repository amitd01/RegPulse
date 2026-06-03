import type { QuestionSummary } from "@/types";

export type HistoryFilterTab = "all" | "high_confidence" | "consult_export" | "this_week";

/** Apply search + tab filters to question history (client-side). */
export function filterQuestionHistory(
  items: QuestionSummary[],
  activeTab: HistoryFilterTab,
  search: string,
): QuestionSummary[] {
  let filtered = items;

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.question_text.toLowerCase().includes(q) ||
        (i.quick_answer ?? "").toLowerCase().includes(q),
    );
  }

  if (activeTab === "high_confidence") {
    filtered = filtered.filter((i) => !i.consult_expert && (i.confidence_score ?? 0) >= 0.8);
  } else if (activeTab === "consult_export") {
    filtered = filtered.filter((i) => i.consult_expert);
  } else if (activeTab === "this_week") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = filtered.filter((i) => new Date(i.created_at) >= weekAgo);
  }

  return filtered;
}
