"use client";

import { LeadType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField, TextAreaField } from "./fields";
import type { LeadScalars } from "./types";
import type { RekommendationGroup } from "@/lib/report-data";

type Props = {
  type: LeadType;
  dataJson: Record<string, unknown>;
  setDataJson: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  lead: LeadScalars;
  setLead: React.Dispatch<React.SetStateAction<LeadScalars>>;
};

export function InnehallTab({ type, dataJson, setDataJson }: Props) {
  const str = (k: string) => (dataJson[k] as string) ?? "";
  const setStr = (k: string) => (v: string) =>
    setDataJson((prev) => ({ ...prev, [k]: v }));
  const bool = (k: string) => Boolean(dataJson[k]);
  const setBool = (k: string, v: boolean) =>
    setDataJson((prev) => ({ ...prev, [k]: v }));

  const groups = (dataJson.rekommendationer as RekommendationGroup[]) ?? [];
  const setGroups = (next: RekommendationGroup[]) =>
    setDataJson((prev) => ({ ...prev, rekommendationer: next }));

  if (type === LeadType.SLUTBESIKTNING) {
    return (
      <div className="space-y-6">
        <TextField label="Avtalsform" value={str("avtalsform") || "Konsumenttjänster"} onChange={setStr("avtalsform")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Närvarande – för beställaren" value={str("narvarandeBestallare")} onChange={setStr("narvarandeBestallare")} />
          <TextField label="Närvarande – för hantverkaren" value={str("narvarandeHantverkare")} onChange={setStr("narvarandeHantverkare")} />
        </div>
        <TextAreaField label="Omfattning" value={str("omfattning")} onChange={setStr("omfattning")} />
        <TextField label="Tid" value={str("tid")} onChange={setStr("tid")} placeholder="t.ex. 2026-05-12 kl. 09:00" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Kallelse – datum" type="date" value={str("kallelseDate")} onChange={setStr("kallelseDate")} />
          <TextField label="Kallelse – sätt" value={str("kallelseMethod")} onChange={setStr("kallelseMethod")} placeholder="t.ex. e-post" />
        </div>
        <TextField label="Kostnad för avhjälpande (SEK)" type="text" value={str("kostnadAvhjalpande")} onChange={setStr("kostnadAvhjalpande")} placeholder="t.ex. 35000" />
        <div className="flex items-center gap-2">
          <input
            id="godkand"
            type="checkbox"
            className="h-4 w-4"
            checked={bool("godkand")}
            onChange={(e) => setBool("godkand", e.target.checked)}
          />
          <Label htmlFor="godkand">Godkänd besiktning</Label>
        </div>
        <TextField label="Datum för besked om godkännande" type="date" value={str("godkandDate")} onChange={setStr("godkandDate")} />
        <TextAreaField label="Reklamationsfrister" value={str("reklamationsfrister")} onChange={setStr("reklamationsfrister")} />
        <TextField label="Avhjälpande-deadline" value={str("avhjalpandeDeadline")} onChange={setStr("avhjalpandeDeadline")} placeholder="t.ex. inom 2 månader" />
        <TextAreaField label="Övriga noteringar" value={str("ovrigaNoteringar")} onChange={setStr("ovrigaNoteringar")} />
        <TextAreaField label="Sändlista (e-postadresser)" value={str("sandlista")} onChange={setStr("sandlista")} placeholder="En adress per rad" />
      </div>
    );
  }

  if (type === LeadType.STATUSBESIKTNING) {
    return (
      <div className="space-y-6">
        <TextAreaField label="Omfattning" value={str("omfattning")} onChange={setStr("omfattning")} />
        <TextField label="Tid" value={str("tid")} onChange={setStr("tid")} />
        <TextAreaField
          label="Övriga noteringar"
          rows={8}
          value={str("ovrigaNoteringar")}
          onChange={setStr("ovrigaNoteringar")}
          placeholder="Fritext, flera stycken (dela med tom rad)"
        />
      </div>
    );
  }

  // SKADEUTREDNING — numbered sections
  return (
    <div className="space-y-6">
      <TextField label="Närvarande – för beställaren" value={str("narvarandeBestallare")} onChange={setStr("narvarandeBestallare")} />
      <TextAreaField label="1. Bakgrund till uppdraget" rows={5} value={str("bakgrund")} onChange={setStr("bakgrund")} />
      <TextAreaField
        label="2. Observationer (punktlista)"
        rows={6}
        value={str("observationer")}
        onChange={setStr("observationer")}
        placeholder="En observation per rad"
      />
      <TextAreaField label="3. Orsak till skada" rows={5} value={str("orsak")} onChange={setStr("orsak")} />
      <TextAreaField
        label="4. Bedömning"
        rows={6}
        value={str("bedomning")}
        onChange={setStr("bedomning")}
        placeholder="Fritext. Bilder för detta avsnitt läggs under fliken Bilder (sektion Bedömning)."
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>5. Rekommendationer / Åtgärdsförslag</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGroups([...groups, { heading: "", bullets: "" }])}
          >
            + Lägg till grupp
          </Button>
        </div>
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">Inga grupper tillagda.</p>
        )}
        {groups.map((g, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 pt-4">
              <TextField
                label="Rubrik"
                value={g.heading}
                onChange={(v) =>
                  setGroups(groups.map((x, idx) => (idx === i ? { ...x, heading: v } : x)))
                }
              />
              <TextAreaField
                label="Punkter (en per rad)"
                value={g.bullets}
                onChange={(v) =>
                  setGroups(groups.map((x, idx) => (idx === i ? { ...x, bullets: v } : x)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGroups(groups.filter((_, idx) => idx !== i))}
              >
                Ta bort grupp
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
