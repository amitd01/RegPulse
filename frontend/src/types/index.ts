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
