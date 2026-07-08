"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Call `schedule(payload)` whenever editable state changes;
 * the latest payload is PATCHed after `delay` ms of quiet. Serialises requests
 * so saves never overlap, and re-fires if state changed while a save was in
 * flight.
 */
export function useAutosave(reportId: string, delay = 800) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<unknown>(null);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (inFlight.current || pending.current == null) return;
    const payload = pending.current;
    pending.current = null;
    inFlight.current = true;
    setStatus("saving");
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus(pending.current == null ? "saved" : "saving");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
      if (pending.current != null) void flush();
    }
  }, [reportId]);

  const schedule = useCallback(
    (payload: unknown) => {
      pending.current = payload;
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush, delay]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { status, schedule };
}
