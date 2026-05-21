"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type {
  PaginatedResponse,
  QuestionResponse,
  QuestionSummary,
} from "@/types";

/** Fetch paginated question history. */
export function useQuestionHistory(page: number = 1, pageSize: number = 20) {
  return useQuery<PaginatedResponse<QuestionSummary>>({
    queryKey: ["questions", "history", page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<QuestionSummary>>(
        "/questions",
        { params: { page, page_size: pageSize } },
      );
      return data;
    },
    staleTime: 15_000,
  });
}

/** Fetch single question detail. */
export function useQuestionDetail(id: string) {
  return useQuery<QuestionResponse>({
    queryKey: ["questions", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<QuestionResponse>(`/questions/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

/** Submit a question (non-streaming). */
export function useAskQuestion() {
  const queryClient = useQueryClient();
  return useMutation<QuestionResponse, Error, string>({
    mutationFn: async (question: string) => {
      const { data } = await api.post<QuestionResponse>("/questions", {
        question,
      });
      return data;
    },
    onSuccess: (data) => {
      // Update credit balance in store
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.setState({
          user: { ...currentUser, credit_balance: data.credit_balance },
        });
      }
      // Invalidate history
      queryClient.invalidateQueries({ queryKey: ["questions", "history"] });
    },
  });
}

/** Submit structured feedback on an answer interpretation. */
export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    { questionId: string; is_helpful: boolean; category?: string; comment?: string }
  >({
    mutationFn: async ({ questionId, is_helpful, category, comment }) => {
      const { data } = await api.patch(`/questions/${questionId}/feedback`, {
        is_helpful,
        category: category || null,
        comment: comment || null,
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["questions", "detail", variables.questionId],
      });
      queryClient.invalidateQueries({ queryKey: ["questions", "history"] });
    },
  });
}
