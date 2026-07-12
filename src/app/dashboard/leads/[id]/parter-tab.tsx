"use client";

import { LeadType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "./fields";
import type { ContractorRow, LeadScalars } from "./types";

type Props = {
  type: LeadType;
  lead: LeadScalars;
  setLead: React.Dispatch<React.SetStateAction<LeadScalars>>;
  contractors: ContractorRow[];
  setContractors: React.Dispatch<React.SetStateAction<ContractorRow[]>>;
  dataJson: Record<string, unknown>;
  setDataJson: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
};

export function ParterTab({
  type,
  lead,
  setLead,
  contractors,
  setContractors,
  dataJson,
  setDataJson,
}: Props) {
  const set = (k: keyof LeadScalars) => (v: string) =>
    setLead((prev) => ({ ...prev, [k]: v }));

  const setData = (k: string, v: string) =>
    setDataJson((prev) => ({ ...prev, [k]: v }));

  function addContractor() {
    setContractors((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        companyName: "",
        orgNr: "",
        contactName: "",
        email: "",
      },
    ]);
  }

  function updateContractor(id: string, k: keyof ContractorRow, v: string) {
    setContractors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [k]: v } : c))
    );
  }

  function removeContractor(id: string) {
    setContractors((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Beställare</h2>
        <TextField label="Namn" value={lead.clientName} onChange={set("clientName")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="E-post" type="email" value={lead.clientEmail} onChange={set("clientEmail")} />
          <TextField label="Telefon" type="tel" value={lead.clientPhone} onChange={set("clientPhone")} />
          <TextField label="Adress" value={lead.clientAddress} onChange={set("clientAddress")} />
          <TextField label="Postnummer" value={lead.clientPostal} onChange={set("clientPostal")} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Objekt / Fastighet</h2>
        <TextField
          label="Fastighetsbeteckning"
          value={lead.propertyDesignation}
          onChange={set("propertyDesignation")}
          placeholder="t.ex. BJÄLKEN 6, STOCKHOLM"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Objektadress" value={lead.propertyAddress} onChange={set("propertyAddress")} />
          <TextField label="Postnummer" value={lead.propertyPostal} onChange={set("propertyPostal")} />
        </div>
      </section>

      {type === LeadType.STATUSBESIKTNING && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Lägenhetsinnehavare</h2>
          <TextField
            label="Närvarande person"
            value={(dataJson.lagenhetsinnehavare as string) ?? ""}
            onChange={(v) => setData("lagenhetsinnehavare", v)}
          />
        </section>
      )}

      {type === LeadType.SKADEUTREDNING && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Konsultföretag</h2>
          <p className="text-sm text-muted-foreground">
            Vårt eget företagsblock (Entreprenadkonsulterna Sthlm AB) infogas
            automatiskt från Inställningar vid dokumentgenerering.
          </p>
        </section>
      )}

      {(type === LeadType.SLUTBESIKTNING || type === LeadType.SKADEUTREDNING) && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Närvarande vid besiktningen</h2>
          <TextField
            label="För beställaren"
            value={(dataJson.narvarandeBestallare as string) ?? ""}
            onChange={(v) => setData("narvarandeBestallare", v)}
            placeholder="Namn, kommaseparerade"
          />
          {type === LeadType.SLUTBESIKTNING && (
            <TextField
              label="För hantverkaren"
              value={(dataJson.narvarandeHantverkare as string) ?? ""}
              onChange={(v) => setData("narvarandeHantverkare", v)}
              placeholder="Namn, kommaseparerade"
            />
          )}
        </section>
      )}

      {type === LeadType.SLUTBESIKTNING && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Hantverkare</h2>
            <Button type="button" variant="outline" size="sm" onClick={addContractor}>
              + Lägg till
            </Button>
          </div>
          <TextField
            label="Avtalsform"
            value={(dataJson.avtalsform as string) ?? ""}
            onChange={(v) => setData("avtalsform", v)}
            placeholder="t.ex. Konsumenttjänster"
          />
          {contractors.length === 0 && (
            <p className="text-sm text-muted-foreground">Inga hantverkare tillagda.</p>
          )}
          {contractors.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 pt-4">
                <TextField label="Företag" value={c.companyName} onChange={(v) => updateContractor(c.id, "companyName", v)} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField label="Org.nr" value={c.orgNr} onChange={(v) => updateContractor(c.id, "orgNr", v)} />
                  <TextField label="Kontaktperson" value={c.contactName} onChange={(v) => updateContractor(c.id, "contactName", v)} />
                </div>
                <TextField label="E-post" type="email" value={c.email} onChange={(v) => updateContractor(c.id, "email", v)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeContractor(c.id)}>
                  Ta bort
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
