"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import api from "@/lib/api";
import type { ApiError, SavedInterpretation, SavedInterpretationListResponse } from "@/types";

export interface SaveInterpretationInput {
  question_id: string;
  name: string;
  tags?: string[];
}

/** Fetch paginated saved interpretations for the current user. */
export function useSavedInterpretations(page: number = 1, pageSize: number = 50) {
  return useQuery<SavedInterpretationListResponse>({
    queryKey: ["saved", "list", page, pageSize],
    queryFn: () => fetchSavedInterpretations(page, pageSize),
    staleTime: 30_000,
  });
}

/** GET /api/v1/saved — list saved interpretations. */
export async function fetchSavedInterpretations(
  page: number = 1,
  pageSize: number = 50,
): Promise<SavedInterpretationListResponse> {
  const { data } = await api.get<SavedInterpretationListResponse>("/saved", {
    params: { page, page_size: pageSize },
  });
  return data;
}

function getSaveErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<ApiError>;
  if (axiosErr.response?.data?.error) {
    return axiosErr.response.data.error;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Failed to save interpretation";
}

/** POST /api/v1/saved — save an interpretation to the library. */
export async function saveInterpretation(
  input: SaveInterpretationInput,
): Promise<SavedInterpretation> {
  const { data } = await api.post<SavedInterpretation>("/saved", {
    question_id: input.question_id,
    name: input.name,
    tags: input.tags ?? [],
  });
  return data;
}

/** Save an interpretation and invalidate the saved list cache. */
export function useSaveInterpretation() {
  const queryClient = useQueryClient();

  return useMutation<SavedInterpretation, Error, SaveInterpretationInput>({
    mutationFn: saveInterpretation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved", "list"] });
    },
  });
}

export { getSaveErrorMessage };

/** Whether the current user has already saved this question. */
export function useIsQuestionSaved(questionId: string | null | undefined): boolean {
  const { data } = useSavedInterpretations(1, 100);

  return useMemo(() => {
    if (!questionId || !data?.data) return false;
    return data.data.some((item) => item.question_id === questionId);
  }, [questionId, data]);
}
