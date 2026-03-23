/**
 * Zustand auth store.
 *
 * Access token stored in memory (Zustand) — NOT localStorage.
 * Refresh token also in memory — backend can optionally set httpOnly cookie.
 */

import { create } from "zustand";
import type { UserResponse } from "@/lib/api/auth";
import { logoutUser, refreshToken as refreshTokenApi } from "@/lib/api/auth";

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshTokenValue: string | null;
  isAuthenticated: boolean;

  /** Set auth state after login / verify-otp / refresh. */
  setAuth: (user: UserResponse, accessToken: string, refreshToken: string) => void;

  /** Clear all auth state (local only — does not call API). */
  clearAuth: () => void;

  /** Full logout: call API, then clear state. */
  logout: () => Promise<void>;

  /** Attempt silent refresh. Returns new access token or null. */
  silentRefresh: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshTokenValue: null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) =>
    set({
      user,
      accessToken,
      refreshTokenValue: refreshToken,
      isAuthenticated: true,
    }),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      refreshTokenValue: null,
      isAuthenticated: false,
    }),

  logout: async () => {
    const rt = get().refreshTokenValue;
    // Clear state immediately so UI reflects logged-out
    get().clearAuth();
    if (rt) {
      try {
        await logoutUser({ refresh_token: rt });
      } catch {
        // Logout is idempotent — ignore errors
      }
    }
  },

  silentRefresh: async () => {
    const rt = get().refreshTokenValue;
    if (!rt) return null;

    try {
      const res = await refreshTokenApi({ refresh_token: rt });
      set({
        user: res.user,
        accessToken: res.tokens.access_token,
        refreshTokenValue: res.tokens.refresh_token,
        isAuthenticated: true,
      });
      return res.tokens.access_token;
    } catch {
      // Refresh failed — force logout
      get().clearAuth();
      return null;
    }
  },
}));
