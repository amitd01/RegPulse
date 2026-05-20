/**
 * Admin uploads — v2 terminal-modern (S7b2a).
 *
 * Manual PDF upload (admin-driven manual circular ingest). Drag-drop zone,
 * title/doc-type form, and a live upload-history feed with status pills.
 * Auto-refreshes every 5s while any upload is pending/processing.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Pill } from "@/components/design/Primitives";

interface ManualUpload {
  id: string;
  admin_id: string;
  filename: string;
  file_size_bytes: number;
  status: string;
  document_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const DOC_TYPES = [
  "CIRCULAR",
  "MASTER_DIRECTION",
  "NOTIFICATION",
  "PRESS_RELEASE",
  "GUIDELINE",
  "OTHER",
] as const;

function useUploads() {
  return useQuery({
    queryKey: ["admin", "uploads"],
    queryFn: async () => {
      const { data } = await api.get("/admin/uploads", {
        params: { page: 1, page_size: 50 },
      });
      return data as { data: ManualUpload[]; total: number };
    },
    refetchInterval: (query) => {
      const uploads = query.state.data?.data ?? [];
      const hasPending = uploads.some(
        (u) => u.status === "PENDING" || u.status === "PROCESSING",
      );
      return hasPending ? 5000 : false;
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const statusTone = (s: string): "good" | "bad" | "warn" | "" => {
  if (s === "COMPLETED") return "good";
  if (s === "FAILED") return "bad";
  if (s === "PROCESSING") return "warn";
  return "";
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--ink-4)",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  marginBottom: 6,
};

export default function UploadsPage() {
  const { data, isLoading } = useUploads();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<string>("CIRCULAR");
  const [dragOver, setDragOver] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("doc_type", docType);
      const { data } = await api.post("/admin/uploads/pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "PDF queued");
        setTitle("");
        if (fileRef.current) fileRef.current.value = "";
      } else {
        toast.error(data.message || "Upload failed");
      }
      qc.invalidateQueries({ queryKey: ["admin", "uploads"] });
    },
    onError: () => toast.error("Upload failed"),
  });

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        toast.error("Only PDF files are accepted");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File too large (max 20MB)");
        return;
      }
      upload.mutate(file);
    },
    [upload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (isLoading) {
    return (
      <div
        className="tick"
        style={{ padding: 48, textAlign: "center", color: "var(--ink-4)" }}
      >
        LOADING UPLOAD QUEUE…
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-uploads">
      <div className="tick" style={{ marginBottom: 8 }}>
        ADMIN · MANUAL PDF UPLOAD · MAX 20MB
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
        PDF upload.
      </h1>

      <div className="panel" style={{ padding: 18, marginBottom: 28 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div>
            <label htmlFor="upload-title" style={labelStyle}>
              Title (optional — extracted from PDF if blank)
            </label>
            <input
              id="upload-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Direction on KYC"
              className="input"
              data-testid="upload-title-input"
            />
          </div>
          <div>
            <label htmlFor="upload-doctype" style={labelStyle}>
              Document type
            </label>
            <select
              id="upload-doctype"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="input"
              data-testid="upload-doctype-input"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          data-testid="upload-dropzone"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: "32px 16px",
            borderRadius: "var(--radius-2)",
            border: `2px dashed ${dragOver ? "var(--signal)" : "var(--line-2)"}`,
            background: dragOver ? "var(--signal-bg)" : "var(--panel-2)",
            color: "var(--ink-3)",
            transition: "background .12s, border-color .12s",
          }}
        >
          <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
            {upload.isPending
              ? "Uploading…"
              : "Drop a PDF here or click to select"}
          </p>
          <p
            className="mono up"
            style={{ marginTop: 6, fontSize: 10, color: "var(--ink-4)", letterSpacing: ".08em" }}
          >
            MAX 20 MB · APPLICATION/PDF
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </div>

      <div className="tick" style={{ marginBottom: 12 }}>
        RECENT UPLOADS · LIVE
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data?.data.length === 0 && (
          <div
            className="panel"
            style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}
          >
            No uploads yet.
          </div>
        )}
        {data?.data.map((u) => (
          <div
            key={u.id}
            className="panel"
            style={{ padding: 14 }}
            data-testid="admin-upload-row"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Pill tone={statusTone(u.status)}>{u.status}</Pill>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}
                >
                  {u.filename}
                </span>
                <span
                  className="mono tnum"
                  style={{ fontSize: 11, color: "var(--ink-4)" }}
                >
                  {formatBytes(u.file_size_bytes)}
                </span>
              </div>
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--ink-4)" }}
              >
                {new Date(u.created_at).toLocaleString("en-IN")}
              </span>
            </div>
            {u.document_id && (
              <p
                className="mono"
                style={{
                  marginTop: 8,
                  fontSize: 11.5,
                  color: "var(--good)",
                  background: "var(--good-bg)",
                  padding: "6px 10px",
                  borderRadius: 2,
                  display: "inline-block",
                }}
              >
                CIRCULAR CREATED ·{" "}
                <a
                  href={`/library/${u.document_id}`}
                  style={{
                    color: "var(--good)",
                    borderBottom: "1px solid var(--good)",
                  }}
                >
                  {u.document_id.slice(0, 8)}…
                </a>
              </p>
            )}
            {u.error_message && (
              <p
                className="mono"
                style={{
                  marginTop: 8,
                  fontSize: 11.5,
                  color: "var(--bad)",
                  background: "var(--bad-bg)",
                  padding: "8px 10px",
                  borderRadius: 2,
                  whiteSpace: "pre-wrap",
                }}
              >
                {u.error_message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
