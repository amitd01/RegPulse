/** Shared TypeScript types for the RegPulse frontend. */

// --- Circular types ---

export interface CircularListItem {
  id: string;
  circular_number: string | null;
  title: string;
  doc_type: string;
  department: string | null;
  issued_date: string | null;
  status: string;
  impact_level: string | null;
  action_deadline: string | null;
  affected_teams: string[] | null;
  tags: string[] | null;
  regulator: string;
  indexed_at: string;
}

export interface CircularSearchResultItem extends CircularListItem {
  relevance_score: number;
  snippet: string | null;
}

export interface ChunkResponse {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  token_count: number;
}

export interface CircularDetail extends CircularListItem {
  effective_date: string | null;
  rbi_url: string;
  ai_summary: string | null;
  pending_admin_review: boolean;
  superseded_by: string | null;
  chunks: ChunkResponse[];
  updated_at: string;
}

// --- Question types ---

export interface CitationItem {
  circular_number: string;
  verbatim_quote: string;
  section_reference: string | null;
}

export interface RecommendedAction {
  team: string;
  action_text: string;
  priority: string;
}

export type FeedbackCategory =
  | "INCORRECT_INTERPRETATION"
  | "MISSING_CITATION"
  | "UI_ISSUE"
  | "COMPLIANCE_CONCERN"
  | "OTHER";

export interface FeedbackRecord {
  is_helpful: boolean;
  category: FeedbackCategory | null;
  comment: string | null;
  created_at: string;
}

export interface QuestionSummary {
  id: string;
  /** Null for the first question in a conversation; set for follow-ups. */
  parent_question_id?: string | null;
  question_text: string;
  quick_answer: string | null;
  risk_level: string | null;
  /** 0.0–1.0; null means the question pre-dates Sprint 4 confidence persistence. */
  confidence_score: number | null;
  /** True when the answer was replaced by the "Consult an Expert" fallback. */
  consult_expert: boolean;
  model_used: string | null;
  credit_deducted: boolean;
  created_at: string;
  feedback_record: FeedbackRecord | null;
}

export interface QuestionDetail extends QuestionSummary {
  answer_text: string | null;
  prompt_version: string | null;
  affected_teams: string[] | null;
  citations: CitationItem[] | null;
  recommended_actions: RecommendedAction[] | null;
  streaming_completed: boolean;
  latency_ms: number | null;
  feedback_record: FeedbackRecord | null;
}

export interface QuestionThreadResponse {
  success: boolean;
  root_question_id: string;
  data: QuestionDetail[];
}

// --- Action item types ---

export type ActionItemPriority = "HIGH" | "MEDIUM" | "LOW";

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assigned_team: string | null;
  priority: ActionItemPriority;
  due_date: string | null;
  status: string;
  source_question_id: string | null;
  source_circular_id: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateActionItemInput {
  title: string;
  description?: string | null;
  assigned_team?: string | null;
  priority?: ActionItemPriority;
  source_question_id?: string;
}

// --- Saved interpretation types ---

export interface SavedInterpretation {
  id: string;
  question_id: string;
  name: string;
  tags: string[] | null;
  needs_review: boolean;
  created_at: string;
}

export interface SavedInterpretationListResponse {
  success: boolean;
  data: SavedInterpretation[];
  total: number;
  page: number;
  page_size: number;
}

// --- API response wrappers ---

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export interface ListResponse<T> {
  success: boolean;
  data: T[];
}

export interface QuestionResponse {
  success: boolean;
  data: QuestionDetail;
  credit_balance: number;
}

export interface AutocompleteItem {
  id: string;
  circular_number: string | null;
  title: string;
  doc_type: string;
}

// --- Filter types ---

export interface CircularFilters {
  query?: string;
  doc_type?: string;
  status?: string;
  regulator?: string;
  impact_level?: string;
  department?: string;
  date_from?: string;
  date_to?: string;
  page: number;
  page_size: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

// --- Error response ---

export interface ApiError {
  success: false;
  error: string;
  code: string;
}
