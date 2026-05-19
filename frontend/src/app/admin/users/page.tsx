/**
 * Admin users — v2 terminal-modern (S7b1).
 *
 * Searchable user table with status pills and one-click activate/deactivate.
 * Uses the .dtable utility from globals.css for the v2 table idiom.
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Btn, Pill } from "@/components/design/Primitives";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  credit_balance: number;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

function useUsers(search: string, page: number) {
  return useQuery({
    queryKey: ["admin", "users", search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (search) params.search = search;
      const { data } = await api.get("/admin/users", { params });
      return data as { data: AdminUser[]; total: number };
    },
  });
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useUsers(search, 1);
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: string;
      value: boolean;
    }) => {
      await api.patch(`/admin/users/${id}`, { [field]: value });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div style={{ padding: "24px 32px 64px" }} data-testid="admin-users">
      <div className="tick" style={{ marginBottom: 8 }}>
        ADMIN · USERS · {data?.total ?? 0} TOTAL
      </div>
      <h1
        className="serif"
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          marginBottom: 20,
        }}
      >
        Users.
      </h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search email or name…"
        className="input"
        data-testid="admin-users-search"
        style={{ maxWidth: 360, marginBottom: 18 }}
      />

      {isLoading && (
        <div
          className="tick"
          style={{ padding: 24, textAlign: "center", color: "var(--ink-4)" }}
        >
          LOADING…
        </div>
      )}

      {data && (
        <div className="panel" style={{ overflowX: "auto", padding: 0 }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Plan</th>
                <th>Credits</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id} data-testid="admin-user-row">
                  <td
                    className="mono"
                    style={{ fontSize: 12, color: "var(--ink)" }}
                  >
                    {u.email}
                  </td>
                  <td>{u.full_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{u.plan}</td>
                  <td className="tnum mono">{u.credit_balance}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {u.is_active ? (
                        <Pill tone="good">ACTIVE</Pill>
                      ) : (
                        <Pill tone="bad">INACTIVE</Pill>
                      )}
                      {u.is_admin && <Pill tone="amber">ADMIN</Pill>}
                    </div>
                  </td>
                  <td>
                    <Btn
                      size="sm"
                      variant="ghost"
                      data-testid="admin-user-toggle"
                      onClick={() =>
                        toggle.mutate({
                          id: u.id,
                          field: "is_active",
                          value: !u.is_active,
                        })
                      }
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
