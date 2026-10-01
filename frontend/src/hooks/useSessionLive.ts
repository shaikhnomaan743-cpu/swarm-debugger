import { useCallback, useEffect, useState } from "react";
import { getSession } from "../services/api";
import type { SessionDetail } from "../types";

export function useSessionLive(sessionId: string | undefined) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const next = await getSession(sessionId);
    setSession(next);
    setError("");
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    void refresh().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load session");
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!sessionId) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/api/ws/sessions/${sessionId}`);
    socket.onmessage = () => {
      void refresh().catch(() => undefined);
    };
    return () => socket.close();
  }, [refresh, sessionId]);

  useEffect(() => {
    if (!sessionId || session?.status !== "running") return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [refresh, session?.status, sessionId]);

  return { session, error, setError, refresh };
}
