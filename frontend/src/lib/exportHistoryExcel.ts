import * as XLSX from "xlsx";

import api from "@/lib/api";
import type { PaginatedResponse, QuestionSummary } from "@/types";

const EXPORT_PAGE_SIZE = 100;

/** Fetch every page of the user's question history. */
export async function fetchAllQuestions(): Promise<QuestionSummary[]> {
  const all: QuestionSummary[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { data } = await api.get<PaginatedResponse<QuestionSummary>>("/questions", {
      params: { page, page_size: EXPORT_PAGE_SIZE },
    });
    all.push(...data.data);
    totalPages =
      data.total_pages ?? Math.max(1, Math.ceil(data.total / EXPORT_PAGE_SIZE));
    page += 1;
  }

  return all;
}

function formatAccuracy(q: QuestionSummary): string {
  if (q.consult_expert) return "Consult expert";
  if (q.confidence_score === null) return "";
  return `${Math.round(q.confidence_score * 100)}%`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Build and download an Excel workbook for the given questions. */
export function exportQuestionsToExcel(items: QuestionSummary[]): void {
  const rows = items.map((q) => ({
    Question: q.question_text,
    Answer: q.quick_answer ?? "",
    "Accuracy %": formatAccuracy(q),
    Medium: q.risk_level ?? "",
    "Date & Time": formatDateTime(q.created_at),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 48 },
    { wch: 72 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Query History");

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `regpulse_query_history_${dateStamp}.xlsx`);
}
