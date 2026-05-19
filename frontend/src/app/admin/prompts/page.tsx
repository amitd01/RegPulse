/**
 * Admin prompts — v2 terminal-modern (S7b1).
 *
 * Manages versioned LLM system prompts. Create form on top, list of versions
 * below with one-click activate on the inactive ones.
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Btn, Pill } from "@/components/design/Primitives";

interface PromptVersion {
  id: string;
  version_tag: string;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
}

function usePrompts() {
  return useQuery({
    queryKey: ["admin", "prompts"],
    queryFn: async () => {
      const { data } = await api.get("/admin/prompts");
      return data as { data: PromptVersion[] };
    },
  });
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--ink-4)",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  marginBottom: 6,
};

export default function PromptsPage() {
  const { data, isLoading } = usePrompts();
  const qc = useQueryClient();
  const [tag, setTag] = useState("");
  const [text, setText] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      await api.post("/admin/prompts", { version_tag: tag, prompt_text: text });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "prompts"] });
      setTag("");
      setText("");
    },
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/prompts/${id}/activate`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "prompts"] }),
  });

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING PROMPT VERSIONS…
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-prompts">
      <div className="tick" style={{ marginBottom: 8 }}>
        ADMIN · LLM SYSTEM PROMPTS · VERSIONED
      </div>
      <h1
        className="serif"
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          marginBottom: 22,
        }}
      >
        Prompt versions.
      </h1>

      <div className="panel" style={{ padding: 16, marginBottom: 28 }}>
        <div className="tick" style={{ marginBottom: 12 }}>
          CREATE NEW VERSION
        </div>
        <label htmlFor="prompt-tag" style={labelStyle}>
          Version tag
        </label>
        <input
          id="prompt-tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. v2.1"
          className="input"
          data-testid="prompt-tag-input"
          style={{ marginBottom: 12 }}
        />
        <label htmlFor="prompt-text" style={labelStyle}>
          Prompt text
        </label>
        <textarea
          id="prompt-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="System prompt body…"
          rows={6}
          className="input"
          data-testid="prompt-text-input"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginBottom: 12 }}
        />
        <Btn
          variant="primary"
          size="sm"
          disabled={!tag || !text || create.isPending}
          onClick={() => create.mutate()}
          data-testid="prompt-create"
        >
          {create.isPending ? "Creating…" : "Create & activate"}
        </Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data?.data.map((p) => (
          <div
            key={p.id}
            className="panel"
            style={{ padding: 14 }}
            data-testid="admin-prompt-row"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink)",
                    background: "var(--panel-2)",
                    padding: "3px 8px",
                    borderRadius: 2,
                  }}
                >
                  {p.version_tag}
                </span>
                {p.is_active && <Pill tone="good">ACTIVE</Pill>}
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--ink-4)" }}
                >
                  {new Date(p.created_at).toLocaleDateString("en-IN")}
                </span>
              </div>
              {!p.is_active && (
                <Btn
                  size="sm"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate(p.id)}
                  data-testid="prompt-activate"
                >
                  Activate
                </Btn>
              )}
            </div>
            <p
              style={{
                marginTop: 8,
                fontSize: 12.5,
                color: "var(--ink-3)",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {p.prompt_text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
