"use client";

import { useState } from "react";
import { LeadType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { TYPE_LABELS } from "@/lib/labels";

type Contractor = {
  companyName: string;
  orgNr: string;
  contactName: string;
  email: string;
};

const emptyContractor: Contractor = {
  companyName: "",
  orgNr: "",
  contactName: "",
  email: "",
};

export function IntakeForm() {
  const [type, setType] = useState<LeadType>(LeadType.SLUTBESIKTNING);
  const [contractors, setContractors] = useState<Contractor[]>([
    { ...emptyContractor },
  ]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ refNumber: string } | null>(null);

  const isSlut = type === LeadType.SLUTBESIKTNING;

  function updateContractor(i: number, key: keyof Contractor, value: string) {
    setContractors((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [key]: value } : c))
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    form.set("type", type);

    // Contractors: only slutbesiktning, drop empty rows.
    const cleanContractors = isSlut
      ? contractors.filter((c) => c.companyName.trim() !== "")
      : [];
    form.set("contractors", JSON.stringify(cleanContractors));

    // Replace the file input's entries with our tracked list.
    form.delete("photos");
    for (const file of photos) form.append("photos", file);

    try {
      const res = await fetch("/api/intake", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Något gick fel. Försök igen.");
        return;
      }
      setResult({ refNumber: data.refNumber });
    } catch {
      setError("Kunde inte skicka. Kontrollera anslutningen och försök igen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6 text-center">
          <div className="text-lg font-semibold text-green-700">
            Tack! Förfrågan är mottagen.
          </div>
          <p className="text-sm text-muted-foreground">
            Ditt ärendenummer är
          </p>
          <p className="text-2xl font-bold tracking-tight">{result.refNumber}</p>
          <p className="text-sm text-muted-foreground">
            Vi återkommer så snart som möjligt.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Honeypot — hidden from humans, tempting to bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="company_website">Lämna tomt</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Typ av uppdrag *</Label>
        <Select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as LeadType)}
        >
          {Object.values(LeadType).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Beställare</legend>
        <div className="space-y-2">
          <Label htmlFor="clientName">Namn *</Label>
          <Input id="clientName" name="clientName" required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientEmail">E-post</Label>
            <Input id="clientEmail" name="clientEmail" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientPhone">Telefon</Label>
            <Input id="clientPhone" name="clientPhone" type="tel" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientAddress">Adress</Label>
            <Input id="clientAddress" name="clientAddress" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientPostal">Postnummer</Label>
            <Input id="clientPostal" name="clientPostal" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Objekt / Fastighet</legend>
        <div className="space-y-2">
          <Label htmlFor="propertyDesignation">
            Fastighetsbeteckning
          </Label>
          <Input
            id="propertyDesignation"
            name="propertyDesignation"
            placeholder="t.ex. BJÄLKEN 6, STOCKHOLM"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Objektadress</Label>
            <Input id="propertyAddress" name="propertyAddress" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyPostal">Postnummer</Label>
            <Input id="propertyPostal" name="propertyPostal" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inspectionDate">Besiktningsdatum</Label>
          <Input id="inspectionDate" name="inspectionDate" type="date" />
        </div>
      </fieldset>

      {isSlut && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">Hantverkare</legend>
          {contractors.map((c, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-4">
                <div className="space-y-2">
                  <Label htmlFor={`contractor-${i}-company`}>Företag</Label>
                  <Input
                    id={`contractor-${i}-company`}
                    value={c.companyName}
                    onChange={(e) =>
                      updateContractor(i, "companyName", e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`contractor-${i}-org`}>Org.nr</Label>
                    <Input
                      id={`contractor-${i}-org`}
                      value={c.orgNr}
                      onChange={(e) =>
                        updateContractor(i, "orgNr", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`contractor-${i}-contact`}>
                      Kontaktperson
                    </Label>
                    <Input
                      id={`contractor-${i}-contact`}
                      value={c.contactName}
                      onChange={(e) =>
                        updateContractor(i, "contactName", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`contractor-${i}-email`}>E-post</Label>
                  <Input
                    id={`contractor-${i}-email`}
                    type="email"
                    value={c.email}
                    onChange={(e) =>
                      updateContractor(i, "email", e.target.value)
                    }
                  />
                </div>
                {contractors.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setContractors((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    Ta bort hantverkare
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setContractors((prev) => [...prev, { ...emptyContractor }])
            }
          >
            + Lägg till hantverkare
          </Button>
        </fieldset>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Noteringar</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder="Kort beskrivning av uppdraget…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="photos">Foton</Label>
        <input
          id="photos"
          name="photos"
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          onChange={(e) =>
            setPhotos(Array.from(e.target.files ?? []).slice(0, 20))
          }
        />
        {photos.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {photos.length} foto{photos.length === 1 ? "" : "n"} valda (max 20).
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Skickar…" : "Skicka förfrågan"}
      </Button>
    </form>
  );
}
