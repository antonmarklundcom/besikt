/**
 * Builds the three starter .docx templates with docxtemplater placeholders.
 * Run: npm run templates:build   (output committed under templates/)
 *
 * These are deliberately plainly styled — the user restyles them in Word.
 * The placeholder contract lives in templates/PLACEHOLDERS.md; keep this
 * script, that document and src/lib/generation/template-data.ts in sync.
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const OUT_DIR = path.resolve(process.cwd(), "templates");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const p = (text: string) => new Paragraph({ children: [new TextRun(text)] });

const pBold = (text: string) =>
  new Paragraph({ children: [new TextRun({ text, bold: true })] });

const small = (text: string) =>
  new Paragraph({
    children: [new TextRun({ text, size: 16, color: "666666" })],
  });

const h1 = (text: string) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_1 });

const h2 = (text: string) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240 } });

const bullet = (text: string) =>
  new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });

const spacer = () => new Paragraph({ children: [] });

function companyHeader(): Header {
  return new Header({
    children: [
      new Paragraph({
        children: [new TextRun({ text: "{foretag_namn}", bold: true, size: 20 })],
      }),
      small("Org.nr {foretag_orgnr} · {foretag_adress}, {foretag_postadress}"),
      small("Tel {foretag_telefon} · {foretag_epost}"),
    ],
  });
}

function pageFooter(): Footer {
  return new Footer({
    children: [
      small("{filnamn}"),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ children: ["Sid ", PageNumber.CURRENT, "(", PageNumber.TOTAL_PAGES, ")"], size: 16 }),
        ],
      }),
    ],
  });
}

function titleBlock(): Paragraph[] {
  return [
    h1("UTLÅTANDE {typ_rubrik}"),
    p("Ärendenummer {ref_nummer} · {datum} · Version {version}"),
    spacer(),
  ];
}

function bestallareBlock(): Paragraph[] {
  return [
    h2("Beställare"),
    p("{bestallare_namn}"),
    p("{bestallare_adress}, {bestallare_postnr}"),
    p("{bestallare_epost} · {bestallare_telefon}"),
  ];
}

function objektBlock(): Paragraph[] {
  return [
    h2("Objekt"),
    p("{fastighetsbeteckning}"),
    p("{objekt_adress}, {objekt_postnr}"),
  ];
}

function signatureBlock(): Paragraph[] {
  return [
    spacer(),
    p("Stockholm {datum}"),
    // Image tags must be ALONE in their own paragraph (free image module).
    p("{#har_signatur}"),
    p("{%bild}"),
    p("{/har_signatur}"),
    pBold("{besiktningsman_namn}"),
    p("{besiktningsman_titel}"),
    p("Certifikat: {cert_nummer}"),
  ];
}

function numreringBlock(): Paragraph[] {
  return [h2("Numrering"), p("{numrering_text}")];
}

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
};

function cell(text: string, opts?: { bold?: boolean; widthPct?: number }): TableCell {
  return new TableCell({
    borders: thinBorder,
    width: opts?.widthPct
      ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts?.bold ?? false })],
      }),
    ],
  });
}

/** Fel-tabell: header row + one data row carrying the {#fel}…{/fel} loop. */
function felTable(withBet: boolean): Table {
  const headers = withBet
    ? ["Bet", "Nr", "Del/Rum", "Fel", "Avhjälpt/sign"]
    : ["Nr", "Del/Rum", "Fel", "Avhjälpt/sign"];
  const widths = withBet ? [8, 8, 22, 47, 15] : [8, 24, 53, 15];
  const dataCells = withBet
    ? ["{#fel}{bet}", "{nr}", "{del_rum}", "{fel_text}", "{/fel}"]
    : ["{#fel}{nr}", "{del_rum}", "{fel_text}", "{/fel}"];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((hd, i) => cell(hd, { bold: true, widthPct: widths[i] })),
      }),
      new TableRow({
        children: dataCells.map((t, i) => cell(t, { widthPct: widths[i] })),
      }),
    ],
  });
}

/**
 * 2-column photo grid: one loop row, v = left photo, h = right photo.
 * {%bild} sits alone in its own paragraph (free image module requirement);
 * the row loop opens in the first cell and closes in the last cell.
 */
function photoGridTable(): Table {
  const photoCell = (paras: Paragraph[]) =>
    new TableCell({
      borders: thinBorder,
      width: { size: 50, type: WidthType.PERCENTAGE },
      children: paras,
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          photoCell([
            p("{#bild_rader}{#v}"),
            p("{%bild}"),
            small("{bildtext}"),
            p("{/v}"),
          ]),
          photoCell([
            p("{#h}"),
            p("{%bild}"),
            small("{bildtext}"),
            p("{/h}{/bild_rader}"),
          ]),
        ],
      }),
    ],
  });
}

function makeDoc(children: (Paragraph | Table)[]): Document {
  return new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
        heading1: { run: { size: 32, bold: true, color: "1A1A1A" } },
        heading2: { run: { size: 24, bold: true, color: "1A1A1A" } },
      },
    },
    sections: [
      {
        headers: { default: companyHeader() },
        footers: { default: pageFooter() },
        children,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// 1. SLUTBESIKTNING
// ---------------------------------------------------------------------------

function slutbesiktning(): Document {
  return makeDoc([
    ...titleBlock(),
    ...bestallareBlock(),
    h2("Hantverkare"),
    p("{#hantverkare}"),
    p("{namn} · Org.nr {orgnr}"),
    p("{kontakt} · {epost}"),
    p("{/hantverkare}"),
    ...objektBlock(),

    h2("Omfattning"),
    p("{omfattning}"),

    h2("Tid"),
    p("{tid}"),
    p("Besiktningsdatum: {besiktning_datum}"),

    h2("Kallelse"),
    p("Kallelse skickades {kallelse_datum} via {kallelse_satt}."),

    h2("Provning och dokumentation"),
    bullet("{#dokumentation}{label} – {datum}{/dokumentation}"),

    h2("Fel"),
    felTable(true),
    small("Bet: H = hantverkaren ansvarig. Kolumnen Avhjälpt/sign fylls i för hand."),

    h2("Kostnad för avhjälpande"),
    p("Bedömd kostnad för avhjälpande av fel: {kostnad}"),

    h2("Besked om godkännande"),
    p("Entreprenaden är: {godkand_text}"),
    p("Datum för besked: {godkand_datum}"),

    h2("Reklamationsfrister"),
    p("{reklamationsfrister}"),

    h2("Avhjälpande"),
    p("Noterade fel ska avhjälpas {avhjalpande_deadline}."),

    h2("Övriga noteringar"),
    p("{ovriga_noteringar}"),

    ...numreringBlock(),

    h2("Sändlista"),
    bullet("{#sandlista}{epost}{/sandlista}"),

    ...signatureBlock(),
  ]);
}

// ---------------------------------------------------------------------------
// 2. STATUSBESIKTNING
// ---------------------------------------------------------------------------

function statusbesiktning(): Document {
  return makeDoc([
    ...titleBlock(),
    ...bestallareBlock(),
    ...objektBlock(),
    h2("Lägenhetsinnehavare"),
    p("Närvarande vid besiktningen: {lagenhetsinnehavare}"),

    h2("Omfattning"),
    p("{omfattning}"),

    h2("Tid"),
    p("{tid}"),
    p("Besiktningsdatum: {besiktning_datum}"),

    h2("Fel"),
    felTable(false),

    h2("Övriga noteringar"),
    p("{ovriga_noteringar}"),

    ...numreringBlock(),

    h2("Bilder"),
    photoGridTable(),

    ...signatureBlock(),
  ]);
}

// ---------------------------------------------------------------------------
// 3. SKADEUTREDNING
// ---------------------------------------------------------------------------

function skadeutredning(): Document {
  return makeDoc([
    ...titleBlock(),
    ...bestallareBlock(),
    h2("Konsultföretag"),
    p("{foretag_namn} · Org.nr {foretag_orgnr}"),
    p("{foretag_adress}, {foretag_postadress}"),
    p("{foretag_telefon} · {foretag_epost}"),
    ...objektBlock(),

    h2("1. Bakgrund till uppdraget"),
    p("{bakgrund}"),

    h2("2. Observationer"),
    bullet("{#observationer}{punkt}{/observationer}"),

    h2("3. Orsak till skada"),
    p("{orsak}"),

    h2("4. Bedömning och bilder"),
    p("{bedomning}"),
    p("{#bedomning_bilder}"),
    p("{%bild}"),
    small("{bildtext}"),
    p("{/bedomning_bilder}"),

    h2("5. Rekommendationer / Åtgärdsförslag"),
    p("{#rekommendationer}"),
    pBold("{rubrik}"),
    bullet("{#punkter}{punkt}{/punkter}"),
    p("{/rekommendationer}"),

    ...numreringBlock(),

    ...signatureBlock(),
  ]);
}

// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const docs: [string, Document][] = [
    ["slutbesiktning.docx", slutbesiktning()],
    ["statusbesiktning.docx", statusbesiktning()],
    ["skadeutredning.docx", skadeutredning()],
  ];
  for (const [name, doc] of docs) {
    const buf = await Packer.toBuffer(doc);
    writeFileSync(path.join(OUT_DIR, name), buf);
    console.log(`Wrote templates/${name} (${buf.length} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
