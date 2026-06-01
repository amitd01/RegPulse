-- Sprint 10 (partial): conversational follow-up threading on questions
-- Each follow-up is a new question row linked via parent_question_id; credits deduct per turn.

ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS parent_question_id UUID REFERENCES questions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_parent_question_id
    ON questions(parent_question_id)
    WHERE parent_question_id IS NOT NULL;
