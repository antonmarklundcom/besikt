"use client";

import { useEffect, useRef, useState } from "react";
import { LeadType, PhotoSection } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { photoSectionsFor, PHOTO_SECTION_LABELS } from "@/lib/report-data";
import type { PhotoRow } from "./types";

type Props = {
  reportId: string;
  type: LeadType;
  photos: PhotoRow[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoRow[]>>;
};

export function BilderTab({ reportId, type, photos, setPhotos }: Props) {
  const sections = photoSectionsFor(type);
  const [uploadSection, setUploadSection] = useState<PhotoSection>(sections[0]!);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounced metadata save (caption / section / order).
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => {
      void fetch(`/api/reports/${reportId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: photos.map((p) => ({
            id: p.id,
            caption: p.caption,
            section: p.section,
          })),
        }),
      });
    }, 700);
    return () => {
      if (metaTimer.current) clearTimeout(metaTimer.current);
    };
  }, [photos, reportId]);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.set("section", uploadSection);
    for (const f of Array.from(files)) form.append("photos", f);
    try {
      const res = await fetch(`/api/reports/${reportId}/photos`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Uppladdning misslyckades.");
        return;
      }
      const rows: PhotoRow[] = (data.photos as { id: string; caption: string | null; section: PhotoSection }[]).map(
        (p) => ({ id: p.id, caption: p.caption ?? "", section: p.section })
      );
      setPhotos((prev) => [...prev, ...rows]);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("Uppladdning misslyckades.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
    if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function update(id: string, patch: Partial<PhotoRow>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function move(index: number, dir: -1 | 1) {
    setPhotos((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-2">
          <Label>Sektion</Label>
          <Select
            value={uploadSection}
            onChange={(e) => setUploadSection(e.target.value as PhotoSection)}
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {PHOTO_SECTION_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ladda upp foton</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            className="block text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
            onChange={(e) => onUpload(e.target.files)}
          />
        </div>
        {uploading && <span className="text-sm text-muted-foreground">Laddar upp…</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Inga bilder uppladdade.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {photos.map((p, i) => (
            <div key={p.id} className="space-y-2 rounded-lg border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${p.id}`}
                alt={p.caption || "Foto"}
                className="aspect-video w-full rounded object-cover"
              />
              <Input
                placeholder="Bildtext"
                value={p.caption}
                onChange={(e) => update(p.id, { caption: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Select
                  value={p.section}
                  onChange={(e) => update(p.id, { section: e.target.value as PhotoSection })}
                >
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {PHOTO_SECTION_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={i === photos.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(p.id)}>
                  Ta bort
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
