import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWorkspace, type WorkspaceData } from "@/lib/api";

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const ws = await fetchWorkspace();
      setData(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void load();
  }, [load]);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource("/events");
    eventSourceRef.current = es;

    es.addEventListener("workspace", () => {
      void load();
    });

    es.addEventListener("refresh", () => {
      void load();
    });

    es.addEventListener("message", () => {
      void load();
    });

    es.onerror = () => {
      // EventSource reconnects automatically; we just silently retry
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [load]);

  return { data, isLoading, error, refresh: load };
}
