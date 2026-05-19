-- Slice 10a: Annotations table (v4 G-15).
--
-- Inline margin notes on AI brief passages, team-scoped (visible to all users
-- in the same org_name as the annotation author). Backs the `<mark
-- class="annot">` spans + AnnotPopover in the Ask + History pages.

CREATE TABLE IF NOT EXISTS annotations (
    id              UUID PRIMARY KEY,
    question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id         UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    text_selection  TEXT NOT NULL,
    note            TEXT NOT NULL,
    anchor_offset   INTEGER NULL,
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_annotations_question_id ON annotations (question_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations (user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_resolved ON annotations (resolved) WHERE resolved = FALSE;

COMMENT ON TABLE annotations IS
    'Team-scoped inline margin notes on AI brief passages (v4 G-15).';
