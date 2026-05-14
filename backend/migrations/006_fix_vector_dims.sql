-- Migration 006: Ensure questions.question_embedding is vector(1536)
--
-- HISTORY
-- -------
-- An earlier version of this file incorrectly tried to ALTER both
-- document_chunks.embedding and questions.question_embedding to vector(3072).
-- That attempt:
--   • Failed on document_chunks (existing 1536-dim rows cannot be recast).
--   • Succeeded on questions (column was empty) — leaving it at vector(3072).
--   • Failed to create IVFFlat indexes (IVFFlat max = 2000 dims, 3072 > limit).
--
-- This replacement migration reverts the damage done to questions and makes
-- the schema consistent with EMBEDDING_DIMS=1536 everywhere.
--
-- Idempotency
-- -----------
-- • If question_embedding is already vector(1536) (fresh DB from 001, or
--   already fixed) the ALTER is a trivial type-to-same-type operation and
--   Postgres completes it without error.
-- • All rows with NULL question_embedding require no USING clause.

ALTER TABLE questions
    ALTER COLUMN question_embedding TYPE vector(1536);
