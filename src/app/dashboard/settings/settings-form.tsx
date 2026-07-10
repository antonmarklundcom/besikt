"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  companyName: string;
  companyOrgNr: string;
  companyAddress: string;
  companyPostal: string;
  companyPhone: string;
  companyEmail: string;
  emailSubjectTmpl: string;
  emailBodyTmpl: string;
};

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof Values>(key: K, value: string) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
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
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Företagsuppgifter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Företagsnamn" value={v.companyName} onChange={(x) => set("companyName", x)} />
          <Field label="Org.nr" value={v.companyOrgNr} onChange={(x) => set("companyOrgNr", x)} />
          <Field label="Adress" value={v.companyAddress} onChange={(x) => set("companyAddress", x)} />
          <Field label="Postadress" value={v.companyPostal} onChange={(x) => set("companyPostal", x)} />
          <Field label="Telefon" value={v.companyPhone} onChange={(x) => set("companyPhone", x)} />
          <Field label="E-post" value={v.companyEmail} onChange={(x) => set("companyEmail", x)} />
        </div>

        <div className="border-t pt-4">
          <p className="mb-1 text-sm font-medium">Standardmallar för e-post</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Platshållare: <code>{"{typ}"}</code>, <code>{"{objekt}"}</code>,{" "}
            <code>{"{företag}"}</code>.
          </p>
          <div className="space-y-4">
            <Field
              label="Ämnesrad"
              value={v.emailSubjectTmpl}
              onChange={(x) => set("emailSubjectTmpl", x)}
            />
            <div className="space-y-2">
              <Label htmlFor="bodyTmpl">Meddelande</Label>
              <Textarea
                id="bodyTmpl"
                rows={6}
                value={v.emailBodyTmpl}
                onChange={(e) => set("emailBodyTmpl", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Sparar…" : "Spara"}
          </Button>
          {msg && (
            <span
              className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}
            >
              {msg.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
