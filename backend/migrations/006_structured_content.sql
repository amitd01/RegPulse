-- Slice 4a: Structured document storage for the v2 renderer.
--
-- Retrieval shape ≠ reading shape (ADR A30, A23).
-- `document_chunks.chunk_text` stays as the retrieval source (512-token windows
-- with embeddings). The new `circular_documents.structured_content` column
-- holds the reading-shape tree: heading hierarchy, paragraphs, tables, lists.
--
-- Shape (block tree, JSONB):
--   {
--     "version": 1,
--     "blocks": [
--       {"type": "heading", "level": 1|2|3, "text": "..."},
--       {"type": "paragraph", "text": "...", "emphasis": [{"start": N, "end": M, "kind": "bold"|"italic"}]?},
--       {"type": "list", "ordered": true|false, "items": [<block>...] },
--       {"type": "table", "headers": ["..."], "rows": [["..."], ...]}
--     ]
--   }
--
-- The structural extractor lands in slice 4b; until then this column is
-- populated by `scripts/seed_demo.py` for the synthetic demo corpus and is
-- NULL for everything else (renderer falls back gracefully).

ALTER TABLE circular_documents
    ADD COLUMN IF NOT EXISTS structured_content JSONB;

-- No index — the column is read whole per circular detail page, never queried.

COMMENT ON COLUMN circular_documents.structured_content IS
    'Reading-shape JSONB tree (heading/paragraph/list/table blocks). '
    'Distinct from document_chunks.chunk_text which is retrieval-shape only.';
