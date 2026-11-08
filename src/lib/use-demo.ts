"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoSnapshot } from "./queries";

/**
 * Polls the demo state so the customer, trusted-contact and fraud-desk views
 * stay in sync across browser windows without a realtime backend.
 */
export function useDemo(intervalMs = 2000) {
  const [data, setData] = useState<DemoSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/demo", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load demo data");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh, intervalMs]);

  const reset = useCallback(async () => {
    const res = await fetch("/api/demo/reset", { method: "POST" });
    if (res.ok) setData(await res.json());
  }, []);

  return { data, error, refresh, reset };
}
