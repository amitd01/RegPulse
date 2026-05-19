-- Slice 9a: v4 backend modules — Learnings, Debates, Debate Replies.
--
-- Implements PRD v4.0 §6.17 (Team Learnings, G-13) + §6.18 (Debates, G-14).
-- Annotations land in slice 10 (§6.19, G-15). Structured-feedback categories
-- ride on the existing questions.feedback_comment column (slice 9d wiring).
--
-- Naming, FKs, JSONB defaults match the patterns established in
-- 001..005 migrations.

-- ---------------------------------------------------------------------------
-- learnings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS learnings (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    question_id         UUID NULL REFERENCES questions(id) ON DELETE SET NULL,
    source_circular_id  UUID NULL REFERENCES circular_documents(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    note                TEXT NULL,
    tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    pinned              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learnings_user_id ON learnings (user_id);
CREATE INDEX IF NOT EXISTS idx_learnings_pinned ON learnings (pinned) WHERE pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings (created_at DESC);

COMMENT ON TABLE learnings IS
    'Team learnings — one-line takeaways forming the institutional regulatory memory (v4 G-13).';

-- ---------------------------------------------------------------------------
-- debates  +  debate_replies
-- ---------------------------------------------------------------------------

-- StrEnum values: OPEN | RESOLVED
CREATE TYPE debate_status_enum AS ENUM ('OPEN', 'RESOLVED');

-- StrEnum values: AGREE | DISAGREE | NEUTRAL
CREATE TYPE debate_stance_enum AS ENUM ('AGREE', 'DISAGREE', 'NEUTRAL');

CREATE TABLE IF NOT EXISTS debates (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    question_id         UUID NULL REFERENCES questions(id) ON DELETE SET NULL,
    source_circular_id  UUID NULL REFERENCES circular_documents(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    opening_text        TEXT NOT NULL,
    status              debate_status_enum NOT NULL DEFAULT 'OPEN',
    resolution_text     TEXT NULL,
    resolved_by         UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debates_status ON debates (status);
CREATE INDEX IF NOT EXISTS idx_debates_created_at ON debates (created_at DESC);

CREATE TABLE IF NOT EXISTS debate_replies (
    id                  UUID PRIMARY KEY,
    debate_id           UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    text                TEXT NOT NULL,
    stance              debate_stance_enum NOT NULL DEFAULT 'NEUTRAL',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debate_replies_debate_id ON debate_replies (debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_replies_created_at ON debate_replies (created_at);

COMMENT ON TABLE debates IS
    'Threaded team disagreements on regulatory interpretations (v4 G-14).';
COMMENT ON TABLE debate_replies IS
    'Replies to a debate with agree/disagree/neutral stance (v4 G-14).';
