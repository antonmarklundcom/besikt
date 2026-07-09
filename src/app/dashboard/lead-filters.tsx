"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LEAD_STATUSES, LEAD_TYPES, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";

export function LeadFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");

  // Debounce the free-text search into the URL.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => {
      update("q", q);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder="Sök namn eller ärendenr…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Select
        value={params.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="">Alla statusar</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <Select
        value={params.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
      >
        <option value="">Alla typer</option>
        {LEAD_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <Select
        value={params.get("sort") ?? "desc"}
        onChange={(e) => update("sort", e.target.value)}
      >
        <option value="desc">Nyast först</option>
        <option value="asc">Äldst först</option>
      </Select>
    </div>
  );
}
