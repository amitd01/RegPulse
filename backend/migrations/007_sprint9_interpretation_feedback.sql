-- Migration 007: Structured Interpretation Feedback
-- Replaces the two flat columns on questions (feedback SMALLINT, feedback_comment TEXT)
-- with a normalised interpretation_feedback table.
--
-- What changes:
--   1. New ENUM  : feedback_category_enum
--   2. New TABLE : interpretation_feedback (question_id, user_id, is_helpful, category, comment)
--   3. Migrate   : existing questions.feedback / feedback_comment rows → new table
--   4. Drop      : questions.feedback, questions.feedback_comment
--
-- Idempotency
--   The CREATE TYPE / TABLE are guarded by IF NOT EXISTS.
--   The INSERT migration is idempotent (ON CONFLICT DO NOTHING).
--   The DROP columns are guarded by IF EXISTS.

-- =============================================================================
-- 1. Category enum
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_category_enum') THEN
        CREATE TYPE feedback_category_enum AS ENUM (
            'INCORRECT_INTERPRETATION',
            'MISSING_CITATION',
            'UI_ISSUE',
            'COMPLIANCE_CONCERN',
            'OTHER'
        );
    END IF;
END$$;

-- =============================================================================
-- 2. interpretation_feedback table
-- =============================================================================
CREATE TABLE IF NOT EXISTS interpretation_feedback (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id  UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    is_helpful   BOOLEAN     NOT NULL,                        -- TRUE = 👍  FALSE = 👎
    category     feedback_category_enum,                      -- optional
    comment      TEXT,                                        -- optional, max 2000 chars
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_interpretation_feedback_question_user
        UNIQUE (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_interp_feedback_question_id
    ON interpretation_feedback (question_id);

CREATE INDEX IF NOT EXISTS idx_interp_feedback_user_id
    ON interpretation_feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_interp_feedback_is_helpful
    ON interpretation_feedback (is_helpful);

CREATE INDEX IF NOT EXISTS idx_interp_feedback_category
    ON interpretation_feedback (category)
    WHERE category IS NOT NULL;

-- =============================================================================
-- 3. Migrate existing data
--    questions.feedback: 1 → is_helpful = TRUE, -1 → is_helpful = FALSE
--    questions.feedback_comment → comment (may contain "[Category] ..." prefix
--    from the old frontend hack — stored as-is for historical fidelity)
-- =============================================================================
INSERT INTO interpretation_feedback (question_id, user_id, is_helpful, comment, created_at, updated_at)
SELECT
    q.id,
    q.user_id,
    CASE WHEN q.feedback = 1 THEN TRUE ELSE FALSE END,
    q.feedback_comment,
    q.created_at,
    q.created_at
FROM questions q
WHERE q.feedback IS NOT NULL
ON CONFLICT (question_id, user_id) DO NOTHING;

-- =============================================================================
-- 4. Drop deprecated columns from questions
-- =============================================================================
ALTER TABLE questions
    DROP COLUMN IF EXISTS feedback,
    DROP COLUMN IF EXISTS feedback_comment;
