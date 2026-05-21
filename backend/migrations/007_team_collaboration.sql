-- Sprint 9: Team Learnings, Debates, Annotations
-- Org sharing keyed by work-email domain (org_domain)

CREATE TYPE debate_stance_enum AS ENUM ('AGREE', 'DISAGREE');
CREATE TYPE debate_status_enum AS ENUM ('OPEN', 'RESOLVED');

-- =============================================================================
-- team_learnings
-- =============================================================================
CREATE TABLE team_learnings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_domain  VARCHAR(255) NOT NULL,
    title       VARCHAR(500) NOT NULL,
    note        TEXT NOT NULL,
    tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_learnings_org_domain ON team_learnings (org_domain);
CREATE INDEX idx_team_learnings_org_pinned ON team_learnings (org_domain, is_pinned DESC, created_at DESC);
CREATE INDEX idx_team_learnings_tags ON team_learnings USING GIN (tags);

-- =============================================================================
-- debates
-- =============================================================================
CREATE TABLE debates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_domain      VARCHAR(255) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT NOT NULL,
    status          debate_status_enum NOT NULL DEFAULT 'OPEN',
    final_decision  TEXT,
    resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_debates_org_domain ON debates (org_domain, created_at DESC);
CREATE INDEX idx_debates_org_status ON debates (org_domain, status);

-- =============================================================================
-- debate_replies
-- =============================================================================
CREATE TABLE debate_replies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id   UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    stance      debate_stance_enum NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_debate_replies_debate_id ON debate_replies (debate_id, created_at ASC);

-- =============================================================================
-- annotations
-- =============================================================================
CREATE TABLE annotations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_domain      VARCHAR(255) NOT NULL,
    selected_text   TEXT NOT NULL,
    note            TEXT,
    start_offset    INTEGER NOT NULL,
    end_offset      INTEGER NOT NULL,
    anchor_path     JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotations_question_org ON annotations (question_id, org_domain);
CREATE INDEX idx_annotations_org_domain ON annotations (org_domain);

-- =============================================================================
-- annotation_replies
-- =============================================================================
CREATE TABLE annotation_replies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id   UUID NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotation_replies_annotation_id ON annotation_replies (annotation_id, created_at ASC);
