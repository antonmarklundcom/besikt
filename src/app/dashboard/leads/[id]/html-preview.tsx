import { LeadType } from "@prisma/client";
import type {
  BildItem,
  SkadeData,
  SlutData,
  StatusData,
  TemplateData,
} from "@/lib/generation/template-data";

// HTML preview of the report data (§1: with PDF_PROVIDER=none the preview is a
// simple HTML render, not the .docx). Consumes the SAME buildTemplateData
// output as the docx renderer so the two cannot drift.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="whitespace-pre-wrap text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function PhotoFigure({ item }: { item: BildItem }) {
  if (!item.bild.photoId) return null;
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/photos/${item.bild.photoId}`}
        alt={item.bildtext || "Foto"}
        className="w-full rounded border object-contain"
      />
      <figcaption className="text-xs text-muted-foreground">{item.bildtext}</figcaption>
    </figure>
  );
}

function FelTable({
  rows,
  withBet,
}: {
  rows: { bet?: string; nr: number; del_rum: string; fel_text: string }[];
  withBet: boolean;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Inga fel.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            {withBet && <th className="py-1 pr-2 font-medium">Bet</th>}
            <th className="py-1 pr-2 font-medium">Nr</th>
            <th className="py-1 pr-2 font-medium">Del/Rum</th>
            <th className="py-1 pr-2 font-medium">Fel</th>
            <th className="py-1 font-medium">Avhjälpt/sign</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nr} className="border-b align-top">
              {withBet && <td className="py-1 pr-2">{r.bet}</td>}
              <td className="py-1 pr-2">{r.nr}</td>
              <td className="py-1 pr-2">{r.del_rum}</td>
              <td className="py-1 pr-2">{r.fel_text}</td>
              <td className="py-1" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Signature({ data }: { data: TemplateData }) {
  return (
    <div className="space-y-0.5 border-t pt-3 text-sm">
      <p>Stockholm {data.datum}</p>
      {data.har_signatur && <p className="italic text-muted-foreground">[Signaturbild]</p>}
      <p className="font-medium">{data.besiktningsman_namn}</p>
      <p>{data.besiktningsman_titel}</p>
      <p>Certifikat: {data.cert_nummer}</p>
    </div>
  );
}

export function HtmlPreview({ type, data }: { type: LeadType; data: TemplateData }) {
  return (
    <div className="space-y-5 rounded-lg border bg-card p-4">
      <header className="space-y-1 border-b pb-3">
        <p className="text-xs text-muted-foreground">
          {data.foretag_namn} · Org.nr {data.foretag_orgnr}
        </p>
        <h2 className="text-lg font-semibold">UTLÅTANDE {data.typ_rubrik}</h2>
        <p className="text-sm text-muted-foreground">
          Ärendenummer {data.ref_nummer} · {data.datum} · Version {data.version}
        </p>
      </header>

      <Section title="Beställare">
        {data.bestallare_namn}
        {"\n"}
        {[data.bestallare_adress, data.bestallare_postnr].filter(Boolean).join(", ")}
        {"\n"}
        {[data.bestallare_epost, data.bestallare_telefon].filter(Boolean).join(" · ")}
      </Section>

      <Section title="Objekt">
        {data.fastighetsbeteckning}
        {"\n"}
        {[data.objekt_adress, data.objekt_postnr].filter(Boolean).join(", ")}
      </Section>

      {type === LeadType.SLUTBESIKTNING && <SlutPreview data={data as SlutData} />}
      {type === LeadType.STATUSBESIKTNING && <StatusPreview data={data as StatusData} />}
      {type === LeadType.SKADEUTREDNING && <SkadePreview data={data as SkadeData} />}

      <Section title="Numrering">{data.numrering_text}</Section>
      <Signature data={data} />
    </div>
  );
}

function SlutPreview({ data }: { data: SlutData }) {
  return (
    <>
      <Section title="Hantverkare">
        {data.hantverkare.length === 0
          ? "—"
          : data.hantverkare
              .map((h) =>
                [`${h.namn} · Org.nr ${h.orgnr}`, [h.kontakt, h.epost].filter(Boolean).join(" · ")]
                  .filter(Boolean)
                  .join("\n")
              )
              .join("\n\n")}
      </Section>
      <Section title="Omfattning">{data.omfattning}</Section>
      <Section title="Tid">
        {data.tid}
        {"\n"}Besiktningsdatum: {data.besiktning_datum}
      </Section>
      <Section title="Kallelse">
        Kallelse skickades {data.kallelse_datum} via {data.kallelse_satt}.
      </Section>
      <Section title="Provning och dokumentation">
        {data.dokumentation.length === 0 ? (
          "—"
        ) : (
          <ul className="list-disc pl-5">
            {data.dokumentation.map((q, i) => (
              <li key={i}>
                {q.label} – {q.datum}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Fel">
        <FelTable rows={data.fel} withBet />
      </Section>
      <Section title="Kostnad för avhjälpande">{data.kostnad}</Section>
      <Section title="Besked om godkännande">
        Entreprenaden är: {data.godkand_text}
        {"\n"}Datum för besked: {data.godkand_datum}
      </Section>
      <Section title="Reklamationsfrister">{data.reklamationsfrister}</Section>
      <Section title="Avhjälpande">
        Noterade fel ska avhjälpas {data.avhjalpande_deadline}.
      </Section>
      <Section title="Övriga noteringar">{data.ovriga_noteringar}</Section>
      <Section title="Sändlista">
        {data.sandlista.map((s) => s.epost).join(", ") || "—"}
      </Section>
    </>
  );
}

function StatusPreview({ data }: { data: StatusData }) {
  const items = data.bild_rader.flatMap((r) =>
    [r.v, r.h].filter((x): x is BildItem => Boolean(x))
  );
  return (
    <>
      <Section title="Lägenhetsinnehavare">{data.lagenhetsinnehavare}</Section>
      <Section title="Omfattning">{data.omfattning}</Section>
      <Section title="Tid">
        {data.tid}
        {"\n"}Besiktningsdatum: {data.besiktning_datum}
      </Section>
      <Section title="Fel">
        <FelTable rows={data.fel} withBet={false} />
      </Section>
      <Section title="Övriga noteringar">{data.ovriga_noteringar}</Section>
      <Section title="Bilder">
        {items.length === 0 ? (
          "Inga bilder."
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((item, i) => (
              <PhotoFigure key={i} item={item} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function SkadePreview({ data }: { data: SkadeData }) {
  return (
    <>
      <Section title="Konsultföretag">
        {data.foretag_namn} · Org.nr {data.foretag_orgnr}
        {"\n"}
        {[data.foretag_adress, data.foretag_postadress].filter(Boolean).join(", ")}
      </Section>
      <Section title="1. Bakgrund till uppdraget">{data.bakgrund}</Section>
      <Section title="2. Observationer">
        {data.observationer.length === 0 ? (
          "—"
        ) : (
          <ul className="list-disc pl-5">
            {data.observationer.map((o, i) => (
              <li key={i}>{o.punkt}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="3. Orsak till skada">{data.orsak}</Section>
      <Section title="4. Bedömning och bilder">
        {data.bedomning}
        {data.bedomning_bilder.length > 0 && (
          <div className="mt-2 space-y-3">
            {data.bedomning_bilder.map((item, i) => (
              <PhotoFigure key={i} item={item} />
            ))}
          </div>
        )}
      </Section>
      <Section title="5. Rekommendationer / Åtgärdsförslag">
        {data.rekommendationer.length === 0 ? (
          "—"
        ) : (
          <div className="space-y-2">
            {data.rekommendationer.map((g, i) => (
              <div key={i}>
                <p className="font-medium text-foreground">{g.rubrik}</p>
                <ul className="list-disc pl-5">
                  {g.punkter.map((pkt, j) => (
                    <li key={j}>{pkt.punkt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
