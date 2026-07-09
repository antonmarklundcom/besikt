"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  reportId: string;
  locked: boolean;
  hasDocx: boolean;
  hasPdf: boolean;
  generatedAt: string | null;
  pdfProviderEnabled: boolean;
};

export function DocumentPanel({
  reportId,
  locked,
  hasDocx,
  hasPdf,
  generatedAt,
  pdfProviderEnabled,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generering misslyckades.");
        return;
      }
      router.refresh();
    } catch {
      setError("Generering misslyckades.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPdf(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.set("pdf", files[0]!);
    try {
      const res = await fetch(`/api/reports/${reportId}/pdf`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Uppladdning misslyckades.");
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Uppladdning misslyckades.");
    } finally {
      setUploading(false);
    }
  }

  async function removePdf() {
    const res = await fetch(`/api/reports/${reportId}/pdf`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokument</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={generate} disabled={busy || locked}>
            {busy ? "Genererar…" : hasDocx ? "Generera om dokument" : "Generera dokument"}
          </Button>
          {generatedAt && (
            <span className="text-sm text-muted-foreground">
              Senast genererad: {generatedAt}
            </span>
          )}
        </div>

        {hasDocx && (
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/reports/${reportId}/files/docx`}
              className="text-sm font-medium underline underline-offset-4"
            >
              Ladda ner .docx
            </a>
            {hasPdf && (
              <a
                href={`/api/reports/${reportId}/files/pdf`}
                className="text-sm font-medium underline underline-offset-4"
              >
                Ladda ner PDF
              </a>
            )}
          </div>
        )}

        {hasDocx && !pdfProviderEnabled && (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">
              {hasPdf ? "PDF bifogad." : "Ladda upp PDF"}
            </p>
            <p className="text-xs text-muted-foreground">
              Öppna .docx-filen i Word, välj ”Spara som PDF” och ladda upp
              resultatet här. PDF:en bifogas denna version.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                disabled={uploading}
                className="block text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => uploadPdf(e.target.files)}
              />
              {uploading && (
                <span className="text-sm text-muted-foreground">Laddar upp…</span>
              )}
              {hasPdf && (
                <Button type="button" variant="ghost" size="sm" onClick={removePdf}>
                  Ta bort PDF
                </Button>
              )}
            </div>
          </div>
        )}

        {locked && (
          <p className="text-sm text-muted-foreground">
            Rapporten är låst — dokumentet kan inte genereras om i denna status.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
