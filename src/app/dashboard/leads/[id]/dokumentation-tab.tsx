"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "./fields";
import type { QualityDocRow } from "./types";

type Props = {
  qualityDocs: QualityDocRow[];
  setQualityDocs: React.Dispatch<React.SetStateAction<QualityDocRow[]>>;
};

export function DokumentationTab({ qualityDocs, setQualityDocs }: Props) {
  function add() {
    setQualityDocs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "", docDate: "" },
    ]);
  }

  function update(id: string, patch: Partial<QualityDocRow>) {
    setQualityDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function remove(id: string) {
    setQualityDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Provning / Dokumentation ({qualityDocs.length})
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Lägg till dokument
        </Button>
      </div>

      {qualityDocs.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Inga kvalitetsdokument tillagda.
        </p>
      )}

      {qualityDocs.map((d) => (
        <Card key={d.id}>
          <CardContent className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-[1fr,auto,auto] sm:items-end">
            <TextField label="Dokument" value={d.label} onChange={(v) => update(d.id, { label: v })} />
            <TextField label="Datum" type="date" value={d.docDate} onChange={(v) => update(d.id, { docDate: v })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(d.id)}>
              Ta bort
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
