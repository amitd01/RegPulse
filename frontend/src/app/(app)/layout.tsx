"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { useAuthStore } from "@/stores/authStore";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  // Gate children render until the refresh-cookie bootstrap settles. Without
  // this, /saved + /ask + every authenticated page fires its initial fetch
  // before silentRefresh() returns, gets 403, and React Query latches into
  // an error state (the interceptor only retries 401, not 403).
  const [authReady, setAuthReady] = useState(Boolean(accessToken));

  useEffect(() => {
    if (accessToken) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    useAuthStore
      .getState()
      .silentRefresh()
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!authReady) {
    return null;
  }

  return <AppShell routeKey={pathname}>{children}</AppShell>;
}
