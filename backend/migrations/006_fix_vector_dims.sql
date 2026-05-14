-- Migration 006: fix vector column dimensions to match EMBEDDING_DIMS=3072
--
-- Root cause: 001_initial_schema.sql defined both document_chunks.embedding
-- and questions.question_embedding as vector(1536), but the embedding service
-- has always used EMBEDDING_DIMS=3072 (text-embedding-3-large default).
-- This mismatch caused db.commit() to fail inside _stream_response after
-- a successful LLM token stream, emitting a spurious event:error to the
-- frontend and rolling back the question history + credit deduction.
--
-- Re-running this migration on a DB that already has vector(3072) columns
-- is a no-op — pgvector allows ALTER COLUMN to the same type without error.

-- Drop the IVFFlat indexes first (required before altering column type)
DROP INDEX IF EXISTS idx_chunks_embedding;
DROP INDEX IF EXISTS idx_questions_embedding;

-- Alter column types
ALTER TABLE document_chunks
    ALTER COLUMN embedding TYPE vector(3072);

ALTER TABLE questions
    ALTER COLUMN question_embedding TYPE vector(3072);

-- Recreate the IVFFlat indexes with the correct dimension
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_questions_embedding
    ON questions
    USING ivfflat (question_embedding vector_cosine_ops)
    WITH (lists = 100);
