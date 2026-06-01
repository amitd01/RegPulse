-- Link team learnings to source AI Q&A answers
ALTER TABLE team_learnings
    ADD COLUMN IF NOT EXISTS source_question_id UUID REFERENCES questions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_learnings_source_question
    ON team_learnings (source_question_id);
