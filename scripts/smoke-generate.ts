/**
 * Renders all three templates from realistic fixture data — no database needed.
 * Run: npm run smoke:generate
 * Fails loudly (exit 1) if any template/tag combination breaks.
 */
import { mkdirSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { LeadType, PhotoSection } from "@prisma/client";
import {
  buildTemplateData,
  type BuildInput,
} from "../src/lib/generation/template-data";
import { renderDocx } from "../src/lib/generation/render-docx";

const OUT = path.join(os.tmpdir(), "rapportverket-smoke");

async function makeTestImage(file: string, w: number, h: number, color: string) {
  await sharp({
    create: { width: w, height: h, channels: 3, background: color },
  })
    .jpeg()
    .toFile(file);
}

async function fixtures(type: LeadType): Promise<BuildInput> {
  mkdirSync(OUT, { recursive: true });
  const img1 = path.join(OUT, "photo1.jpg");
  const img2 = path.join(OUT, "photo2.jpg");
  const img3 = path.join(OUT, "photo3.jpg");
  const sig = path.join(OUT, "signature.jpg");
  await makeTestImage(img1, 1600, 1200, "#88aacc");
  await makeTestImage(img2, 1200, 1600, "#cc8888");
  await makeTestImage(img3, 1600, 900, "#88cc88");
  await makeTestImage(sig, 400, 120, "#dddddd");

  const findings = Array.from({ length: 27 }, (_, i) => ({
    bet: i % 3 === 0 ? "H" : null,
    delRum: `Rum ${1 + (i % 5)} / vägg ${1 + (i % 4)}`,
    felText: `Fel nummer ${i + 1}: sprickbildning i ytskikt, kulör avviker (testrad).`,
  }));

  return {
    lead: {
      refNumber: "EK-2026-042",
      type,
      clientName: "Anna Andersson",
      clientEmail: "anna@example.com",
      clientPhone: "070-123 45 67",
      clientAddress: "Storgatan 1",
      clientPostal: "114 55 Stockholm",
      propertyDesignation: "BJÄLKEN 6, STOCKHOLM",
      propertyAddress: "Storgatan 1, lgh 1203",
      propertyPostal: "114 55 Stockholm",
      inspectionDate: new Date("2026-06-15"),
    },
    report: {
      version: 1,
      dataJson: {
        avtalsform: "Konsumenttjänster",
        narvarandeBestallare: "Anna Andersson och John Wästerlund",
        narvarandeHantverkare: "Karl Nyström\nFredrik Åberg",
        omfattning: "Besiktning av totalrenoverat badrum samt kök.",
        tid: "2026-06-15 kl. 09:00–12:00",
        kallelseDate: "2026-06-01",
        kallelseMethod: "e-post",
        kostnadAvhjalpande: "35000",
        godkand: true,
        godkandDate: "2026-06-15",
        reklamationsfrister:
          "Beställaren ska reklamera fel som framträder efter besiktningen inom skälig tid.",
        avhjalpandeDeadline: "inom 2 månader",
        ovrigaNoteringar: "Vattenavstängning fungerar.\nRadiator i hall kärvar.",
        sandlista: "anna@example.com\nbygg@hantverkarna.se",
        lagenhetsinnehavare: "Bertil Bengtsson",
        bakgrund:
          "Beställaren har noterat fuktskada i badrummets tak och önskar utredning av orsak.",
        observationer:
          "Missfärgning i tak, ca 40x60 cm\nFörhöjd fuktkvot i takskiva (18 %)\nSpår av tidigare läckage vid golvbrunn",
        orsak:
          "Läckage från ovanliggande lägenhets golvbrunn, sannolikt vid klinkerfog.",
        bedomning:
          "Skadan är begränsad till takskivan. Bärande konstruktion är ej påverkad.",
        rekommendationer: [
          {
            heading: "Omedelbara åtgärder",
            bullets: "Täta golvbrunn i ovanliggande lägenhet\nTorka ut takskivan",
          },
          {
            heading: "Inom 6 månader",
            bullets: "Byt takskiva\nMåla om tak",
          },
        ],
      },
    },
    contractors: [
      { companyName: "Bygg & Co AB", orgNr: "556677-8899", contactName: "Carl Carlsson", email: "carl@byggco.se" },
      { companyName: "Rör AB", orgNr: "556011-2233", contactName: "Diana D", email: "info@rorab.se" },
      { companyName: "El-firman AB", orgNr: "556999-0000", contactName: "Erik E", email: "erik@elfirman.se" },
    ],
    findings,
    qualityDocs: [
      { label: "Kvalitetsdokument tätskikt (BKR)", docDate: new Date("2026-05-20") },
      { label: "Egenkontroll el", docDate: new Date("2026-05-25") },
    ],
    photos: [
      { id: "p1", filePath: img1, caption: "Badrum, tak — missfärgning", section: PhotoSection.BILDER },
      { id: "p2", filePath: img2, caption: "Kök, diskbänk", section: PhotoSection.BILDER },
      { id: "p3", filePath: img3, caption: "Golvbrunn ovanliggande lägenhet", section: PhotoSection.BEDOMNING },
      { id: "p4", filePath: img1, caption: "Takskiva, fuktmätpunkt", section: PhotoSection.BEDOMNING },
    ],
    inspector: {
      name: "Sven Svensson",
      title: "Certifierad besiktningsman SBR",
      certNumber: "KIWA 12345",
      signatureImagePath: sig,
    },
    settings: {
      companyName: "Entreprenadkonsulterna Sthlm AB",
      companyOrgNr: "559123-4567",
      companyAddress: "Kungsgatan 10",
      companyPostal: "111 43 Stockholm",
      companyPhone: "08-123 456 78",
      companyEmail: "info@entreprenadkonsulterna.se",
    },
  };
}

async function main() {
  for (const type of [
    LeadType.SLUTBESIKTNING,
    LeadType.STATUSBESIKTNING,
    LeadType.SKADEUTREDNING,
  ]) {
    const input = await fixtures(type);
    const data = await buildTemplateData(input);
    const buf = renderDocx(type, data);
    const out = path.join(OUT, `smoke-${type.toLowerCase()}.docx`);
    writeFileSync(out, buf);
    console.log(`OK ${type}: ${buf.length} bytes -> ${out}`);
  }
  console.log("All three templates rendered without errors.");
}

main().catch((e) => {
  // docxtemplater aggregates template errors; surface each one readably.
  const errs = e?.properties?.errors;
  if (Array.isArray(errs)) {
    for (const sub of errs) {
      console.error("TEMPLATE ERROR:", sub.properties?.explanation ?? sub.message);
    }
  }
  console.error(e.stack ?? e.message);
  process.exit(1);
});
