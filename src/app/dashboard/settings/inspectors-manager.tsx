"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Inspector = {
  id: string;
  name: string;
  title: string;
  certBody: string;
  certNumber: string;
  email: string;
  phone: string;
  hasSignature: boolean;
};

export function InspectorsManager({ inspectors }: { inspectors: Inspector[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/inspectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ny besiktningsman" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kunde inte skapa.");
        return;
      }
      router.refresh();
    } catch {
      setError("Kunde inte skapa.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Besiktningsmän</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={creating}
          onClick={() => void create()}
        >
          {creating ? "Lägger till…" : "Lägg till"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {inspectors.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Inga besiktningsmän ännu. Lägg till en för att fylla i signaturblocket
            på rapporterna.
          </p>
        )}
        {inspectors.map((insp) => (
          <InspectorRow key={insp.id} inspector={insp} />
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function InspectorRow({ inspector }: { inspector: Inspector }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState(inspector);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Cache-buster so a re-uploaded signature refreshes in the preview.
  const [sigVersion, setSigVersion] = useState(0);

  function set<K extends keyof Inspector>(key: K, value: string) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch(`/api/inspectors/${inspector.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Kunde inte spara." });
        return;
      }
      setMsg({ ok: true, text: "Sparat." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Kunde inte spara." });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`Ta bort ${v.name}?`)) return;
    setBusy("remove");
    try {
      const res = await fetch(`/api/inspectors/${inspector.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function uploadSignature(file: File) {
    setBusy("sig");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/inspectors/${inspector.id}/signature`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Uppladdning misslyckades." });
        return;
      }
      setSigVersion((n) => n + 1);
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Uppladdning misslyckades." });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeSignature() {
    setBusy("sig");
    try {
      const res = await fetch(`/api/inspectors/${inspector.id}/signature`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSigVersion((n) => n + 1);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Cell label="Namn" value={v.name} onChange={(x) => set("name", x)} />
        <Cell label="Titel" value={v.title} onChange={(x) => set("title", x)} />
        <Cell label="Certifieringsorgan" value={v.certBody} onChange={(x) => set("certBody", x)} />
        <Cell label="Cert.nr" value={v.certNumber} onChange={(x) => set("certNumber", x)} />
        <Cell label="E-post" value={v.email} onChange={(x) => set("email", x)} />
        <Cell label="Telefon" value={v.phone} onChange={(x) => set("phone", x)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Signatur:</span>
        {inspector.hasSignature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/inspectors/${inspector.id}/signature?v=${sigVersion}`}
            alt="Signatur"
            className="h-12 w-auto rounded border bg-white p-1"
          />
        ) : (
          <span className="text-sm text-muted-foreground">Ingen uppladdad</span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadSignature(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "sig" ? "…" : inspector.hasSignature ? "Byt" : "Ladda upp"}
        </Button>
        {inspector.hasSignature && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void removeSignature()}
          >
            Ta bort signatur
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={busy !== null} onClick={() => void save()}>
          {busy === "save" ? "Sparar…" : "Spara"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={busy !== null}
          onClick={() => void remove()}
        >
          Ta bort
        </Button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
