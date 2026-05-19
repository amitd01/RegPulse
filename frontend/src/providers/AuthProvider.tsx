/**
 * AuthProvider — restores the user session on every page load.
 *
 * Problem solved:
 *   Zustand is in-memory and resets on every browser refresh. The HttpOnly
 *   refresh_token cookie survives the reload but nothing reads it unless
 *   we explicitly call silentRefresh() on mount.
 *
 * How it works:
 *   1. On mount, POST /auth/refresh is called (browser auto-sends the cookie).
 *   2. If the cookie is valid, the backend returns a new access_token + user.
 *      Zustand is populated — app continues as authenticated.
 *   3. If the cookie is missing / expired / revoked, the call fails, Zustand
 *      stays cleared, and the middleware (which checks the cookie) handles
 *      the redirect to /login.
 *   4. A full-screen spinner is shown while the attempt is in-flight so that
 *      child components never render in a "not logged in" flash-state.
 *
 * Security notes:
 *   - No token is read from localStorage or sessionStorage.
 *   - The HttpOnly cookie is never accessible from JS — the browser attaches
 *     it automatically to the /auth/refresh request via withCredentials.
 *   - silentRefresh() is called exactly once per page load (empty dep array).
 */

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isHydrating, setIsHydrating] = useState(true);
  const silentRefresh = useAuthStore((s) => s.silentRefresh);

  useEffect(() => {
    // Attempt to restore session from the HttpOnly refresh_token cookie.
    // Always finish hydrating regardless of outcome — failure means
    // the middleware will redirect to /login on the next render cycle.
    silentRefresh().finally(() => setIsHydrating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  if (isHydrating) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
