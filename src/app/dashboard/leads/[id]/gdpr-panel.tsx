"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// §7 GDPR actions. "Arkivera" is soft (keeps data); "Radera" is destructive
// (deletes files + rows, anonymises the lead). Both live behind confirms.
export function GdprPanel({
  leadId,
  status,
}: {
  leadId: string;
  status: LeadStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isArchived = status === LeadStatus.ARKIVERAD;

  async function archive() {
    if (!window.confirm("Arkivera leaden? Data behålls men leaden låses.")) return;
    setBusy("archive");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/archive`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Åtgärden misslyckades.");
        return;
      }
      router.refresh();
    } catch {
      setError("Åtgärden misslyckades.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        "Radera all persondata och alla filer permanent? Endast referensnummer och tidsstämplar behålls. Detta kan inte ångras."
      )
    )
      return;
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Radering misslyckades.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Radering misslyckades.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">Dataskydd (GDPR)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <strong>Arkivera</strong> låser leaden men behåller all data.{" "}
          <strong>Radera</strong> tar bort persondata, bilder och genererade
          filer permanent — endast referensnummer, typ och tidsstämplar sparas
          som spårbarhet.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || isArchived}
            onClick={() => void archive()}
          >
            {busy === "archive" ? "Arkiverar…" : isArchived ? "Arkiverad" : "Arkivera"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            {busy === "remove" ? "Raderar…" : "Radera"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
