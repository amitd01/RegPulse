"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import api from "@/lib/api";
import type {
  ActionItem,
  ActionItemPriority,
  ApiError,
  CreateActionItemInput,
  RecommendedAction,
} from "@/types";

export interface ShareWithTeamInput {
  questionId: string;
  question?: string;
  quickAnswer?: string | null;
  recommendedActions: RecommendedAction[];
}

export interface ShareWithTeamResult {
  created: number;
  total: number;
}

function normalizePriority(priority: string): ActionItemPriority {
  const upper = priority.toUpperCase();
  if (upper === "HIGH" || upper === "LOW") return upper;
  return "MEDIUM";
}

function buildFallbackTitle(question?: string, quickAnswer?: string | null): string {
  const source = question?.trim() || quickAnswer?.trim() || "Interpretation follow-up";
  return source.length > 500 ? `${source.slice(0, 497)}...` : source;
}

export function getActionItemErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<ApiError>;
  if (axiosErr.response?.data?.error) {
    return axiosErr.response.data.error;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Failed to share with team";
}

/** POST /api/v1/action-items — create one action item. */
export async function createActionItem(input: CreateActionItemInput): Promise<ActionItem> {
  const { data } = await api.post<ActionItem>("/action-items", {
    title: input.title,
    description: input.description ?? null,
    assigned_team: input.assigned_team ?? null,
    priority: input.priority ?? "MEDIUM",
    source_question_id: input.source_question_id ?? null,
  });
  return data;
}

/** Create action items from recommended actions (or one fallback) for the team. */
export async function shareInterpretationWithTeam(
  input: ShareWithTeamInput,
): Promise<ShareWithTeamResult> {
  const description = input.question?.trim() || null;

  const payloads: CreateActionItemInput[] =
    input.recommendedActions.length > 0
      ? input.recommendedActions.map((action) => ({
          title:
            action.action_text.length > 500
              ? `${action.action_text.slice(0, 497)}...`
              : action.action_text,
          description,
          assigned_team: action.team || null,
          priority: normalizePriority(action.priority),
          source_question_id: input.questionId,
        }))
      : [
          {
            title: buildFallbackTitle(input.question, input.quickAnswer),
            description: input.quickAnswer?.trim() || description,
            assigned_team: null,
            priority: "MEDIUM",
            source_question_id: input.questionId,
          },
        ];

  const results = await Promise.allSettled(payloads.map((p) => createActionItem(p)));
  const created = results.filter((r) => r.status === "fulfilled").length;

  if (created === 0) {
    const firstFailure = results.find((r) => r.status === "rejected");
    throw (firstFailure as PromiseRejectedResult | undefined)?.reason ?? new Error(
      "Failed to create action items",
    );
  }

  if (created < results.length) {
    throw new Error(
      `Only ${created} of ${results.length} action items were created. Check Action Items for details.`,
    );
  }

  return { created, total: results.length };
}

/** Share interpretation recommended actions with the team via action items. */
export function useShareWithTeam() {
  const queryClient = useQueryClient();

  return useMutation<ShareWithTeamResult, Error, ShareWithTeamInput>({
    mutationFn: shareInterpretationWithTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
      queryClient.invalidateQueries({ queryKey: ["action-items-stats"] });
      queryClient.invalidateQueries({ queryKey: ["action-items-badge"] });
    },
  });
}
