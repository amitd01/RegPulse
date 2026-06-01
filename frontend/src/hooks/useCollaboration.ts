import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface AuthorSummary {
  id: string;
  full_name: string;
  email: string;
}

export interface TeamLearning {
  id: string;
  user_id: string;
  source_question_id: string | null;
  title: string;
  note: string;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: AuthorSummary;
}

export interface LearningStats {
  total: number;
  pinned_count: number;
  this_week: number;
  this_month: number;
  unique_contributors: number;
  top_tags: { tag: string; count: number }[];
  activity_by_day: { date: string; count: number }[];
}

export interface DebateSummary {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  final_decision: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reply_count: number;
  agree_count: number;
  disagree_count: number;
  creator?: AuthorSummary;
}

export interface DebateReply {
  id: string;
  user_id: string;
  content: string;
  stance: string;
  created_at: string;
  author?: AuthorSummary;
}

export interface DebateDetail extends DebateSummary {
  replies: DebateReply[];
}

export interface AnnotationReply {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: AuthorSummary;
}

export interface Annotation {
  id: string;
  question_id: string;
  user_id: string;
  selected_text: string;
  note: string | null;
  start_offset: number;
  end_offset: number;
  anchor_path: string[];
  created_at: string;
  updated_at: string;
  author?: AuthorSummary;
  replies: AnnotationReply[];
}

export function useLearnings(page: number, tag?: string) {
  return useQuery({
    queryKey: ["learnings", page, tag],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (tag) params.tag = tag;
      const { data } = await api.get("/learnings", { params });
      return data as { data: TeamLearning[]; total: number };
    },
  });
}

export function useLearningStats() {
  return useQuery({
    queryKey: ["learnings-stats"],
    queryFn: async () => {
      const { data } = await api.get("/learnings/stats");
      return data as LearningStats;
    },
  });
}

export function useCreateLearning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      note: string;
      tags: string[];
      source_question_id?: string;
    }) => {
      const { data } = await api.post("/learnings", body);
      return data as TeamLearning;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learnings"] });
      qc.invalidateQueries({ queryKey: ["learnings-stats"] });
    },
  });
}

export function usePinLearning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { data } = await api.post(`/learnings/${id}/pin`, { pinned });
      return data as TeamLearning;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learnings"] });
      qc.invalidateQueries({ queryKey: ["learnings-stats"] });
    },
  });
}

export function useDeleteLearning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/learnings/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learnings"] });
      qc.invalidateQueries({ queryKey: ["learnings-stats"] });
    },
  });
}

export function useDebates(page: number, status?: string) {
  return useQuery({
    queryKey: ["debates", page, status],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (status) params.status = status;
      const { data } = await api.get("/debates", { params });
      return data as { data: DebateSummary[]; total: number };
    },
  });
}

export function useDebateDetail(id: string) {
  return useQuery({
    queryKey: ["debates", id],
    queryFn: async () => {
      const { data } = await api.get(`/debates/${id}`);
      return data as { data: DebateDetail };
    },
    enabled: !!id,
  });
}

export function useCreateDebate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; description: string }) => {
      const { data } = await api.post("/debates", body);
      return data as { data: DebateDetail };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debates"] }),
  });
}

export function usePostDebateReply(debateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { content: string; stance: "AGREE" | "DISAGREE" }) => {
      const { data } = await api.post(`/debates/${debateId}/replies`, body);
      return data as DebateReply;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debates", debateId] });
      qc.invalidateQueries({ queryKey: ["debates"] });
    },
  });
}

export function useResolveDebate(debateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (final_decision: string) => {
      const { data } = await api.post(`/debates/${debateId}/resolve`, { final_decision });
      return data as { data: DebateDetail };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debates", debateId] });
      qc.invalidateQueries({ queryKey: ["debates"] });
    },
  });
}

export function useAnnotations(questionId: string) {
  return useQuery({
    queryKey: ["annotations", questionId],
    queryFn: async () => {
      const { data } = await api.get("/annotations", { params: { question_id: questionId } });
      return data as { data: Annotation[] };
    },
    enabled: !!questionId,
  });
}

export function useCreateAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      question_id: string;
      selected_text: string;
      note?: string;
      start_offset: number;
      end_offset: number;
      anchor_path?: string[];
    }) => {
      const { data } = await api.post("/annotations", body);
      return data as Annotation;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["annotations", vars.question_id] });
    },
  });
}

export function usePostAnnotationReply(annotationId: string, questionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post(`/annotations/${annotationId}/replies`, { content });
      return data as AnnotationReply;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotations", questionId] }),
  });
}

export function useDeleteAnnotation(questionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/annotations/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotations", questionId] }),
  });
}
