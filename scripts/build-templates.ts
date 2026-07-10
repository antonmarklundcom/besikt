/**
 * Builds the three .docx templates with docxtemplater placeholders, styled to
 * match the firm's real reports (see the reference PDFs the layout was taken
 * from: header with logos, "Sid X(Y)", blue fel-tabell, company-block footer
 * on page 1, "Filnamn:" footer on later pages, label/value party blocks).
 *
 * Run: npm run templates:build   (output committed under templates/)
 * The placeholder contract lives in templates/PLACEHOLDERS.md; keep this
 * script, that document and src/lib/generation/template-data.ts in sync.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const OUT_DIR = path.resolve(process.cwd(), "templates");
const ASSETS = path.join(OUT_DIR, "assets");

const BLUE = "4472C4"; // fel-tabell header (matches the reference reports)
const FONT = "Arial";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const run = (text: string, opts: Partial<ConstructorParameters<typeof TextRun>[0] & object> = {}) =>
  new TextRun({ text, font: FONT, size: 22, ...(opts as object) });

const p = (text: string) => new Paragraph({ children: [run(text)] });

const pMulti = (texts: string[]) =>
  new Paragraph({
    children: texts.flatMap((t, i) =>
      i === 0 ? [run(t)] : [new TextRun({ break: 1 }), run(t)]
    ),
  });

const pBold = (text: string) =>
  new Paragraph({ children: [run(text, { bold: true })] });

const pItalic = (text: string) =>
  new Paragraph({ children: [run(text, { italics: true, size: 18 })] });

const pUnderline = (text: string) =>
  new Paragraph({
    spacing: { before: 160 },
    children: [run(text, { underline: {} })],
  });

const small = (text: string) =>
  new Paragraph({ children: [run(text, { size: 16, color: "444444" })] });

const h1 = (text: string) =>
  new Paragraph({
    spacing: { before: 120, after: 60 },
    children: [run(text, { bold: true, size: 36 })],
  });

const h2 = (text: string) =>
  new Paragraph({
    spacing: { before: 280, after: 80 },
    children: [run(text, { bold: true, size: 26 })],
  });

const bullet = (text: string) =>
  new Paragraph({ children: [run(text)], bullet: { level: 0 } });

const spacer = () => new Paragraph({ children: [] });

// ---------------------------------------------------------------------------
// Borders / tables
// ---------------------------------------------------------------------------

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: none,
  bottom: none,
  left: none,
  right: none,
  insideHorizontal: none,
  insideVertical: none,
};

const thin = { style: BorderStyle.SINGLE, size: 4, color: "7F7F7F" };
const THIN_BORDERS = {
  top: thin,
  bottom: thin,
  left: thin,
  right: thin,
  insideHorizontal: thin,
  insideVertical: thin,
};

function cellParas(paras: Paragraph[], widthPct?: number, shaded = false): TableCell {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: shaded
      ? { fill: BLUE, type: ShadingType.CLEAR, color: "auto" }
      : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: paras,
  });
}

const headCell = (text: string, widthPct: number) =>
  cellParas(
    [new Paragraph({ children: [run(text, { bold: true, color: "FFFFFF" })] })],
    widthPct,
    true
  );

/** Borderless label/value block (the party sections in the real reports). */
function kvTable(rows: [string, string[]][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: rows.map(
      ([label, values]) =>
        new TableRow({
          children: [
            cellParas([p(label)], 34),
            cellParas(values.map((v) => p(v)), 66),
          ],
        })
    ),
  });
}

/** Hantverkare rows repeat via a row loop inside the same borderless table. */
function hantverkareTable(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          cellParas([p("{#hantverkare}Hantverkare /(Näringsidkare):"), p("Org.nr:")], 34),
          cellParas([p("{namn}"), p("{orgnr}{/hantverkare}")], 66),
        ],
      }),
    ],
  });
}

/** Fel-tabell — blue header row, thin grid, loop row (Bet blank when unused). */
function felTable(): Table {
  const widths = [8, 7, 20, 53, 12];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: THIN_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headCell("Bet.", widths[0]!),
          headCell("Nr", widths[1]!),
          headCell("Del / Rum", widths[2]!),
          headCell("Fel", widths[3]!),
          headCell("Avhjälpt /sign", widths[4]!),
        ],
      }),
      new TableRow({
        children: [
          cellParas([p("{#fel}{bet}")], widths[0]),
          cellParas([p("{nr}.")], widths[1]),
          cellParas([p("{del_rum}")], widths[2]),
          cellParas([p("{fel_text}")], widths[3]),
          cellParas([p("{/fel}")], widths[4]),
        ],
      }),
    ],
  });
}

/** Borderless 2-column photo grid ("Bilder" in statusbesiktning). */
function photoGridTable(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          cellParas(
            [p("{#bild_rader}{#v}"), p("{%bild}"), p("{bildtext}"), p("{/v}")],
            50
          ),
          cellParas(
            [p("{#h}"), p("{%bild}"), p("{bildtext}"), p("{/h}{/bild_rader}")],
            50
          ),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Header / footers (match the reference layout)
// ---------------------------------------------------------------------------

function logo(file: string, width: number, height: number): ImageRun | TextRun {
  const full = path.join(ASSETS, file);
  if (!existsSync(full)) {
    return run("ENTREPRENADKONSULTERNA.SE", { bold: true, size: 18 });
  }
  return new ImageRun({
    type: "png",
    data: readFileSync(full),
    transformation: { width, height },
  });
}

function pageHeader(): Header {
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              cellParas(
                [new Paragraph({ children: [logo("logo-ek.png", 168, 54)] })],
                55
              ),
              cellParas(
                [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [logo("logo-sbb.png", 78, 48)],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        font: FONT,
                        size: 20,
                        children: ["Sid ", PageNumber.CURRENT, "(", PageNumber.TOTAL_PAGES, ")"],
                      }),
                    ],
                  }),
                ],
                45
              ),
            ],
          }),
        ],
      }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
        children: [],
      }),
    ],
  });
}

const topRule = () =>
  new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
    children: [],
  });

/** Page 1 footer: the company block (from Inställningar). */
function firstPageFooter(): Footer {
  return new Footer({
    children: [
      topRule(),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              cellParas(
                [small("{foretag_namn}"), small("{foretag_adress}"), small("{foretag_postadress}")],
                50
              ),
              cellParas(
                [small("Org.nr: {foretag_orgnr}"), small("{foretag_epost}"), small("{foretag_telefon}")],
                50
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Later pages: "Filnamn: …" centered. */
function laterPagesFooter(): Footer {
  return new Footer({
    children: [
      topRule(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run("Filnamn: {filnamn}    {datum}", { size: 16, color: "444444" })],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

function titleBlock(): Paragraph[] {
  return [
    h1("{fastighetsbeteckning}"),
    h1("UTLÅTANDE ÖVER {typ_rubrik}"),
    spacer(),
  ];
}

function signatureBlock(): Paragraph[] {
  return [
    spacer(),
    spacer(),
    p("{besiktningsman_namn}"),
    // Image tags must be ALONE in their own paragraph (free image module).
    p("{#har_signatur}"),
    p("{%bild}"),
    p("{/har_signatur}"),
    pItalic("{besiktningsman_titel}"),
    pItalic("KIWA certifikatnummer: {cert_nummer}"),
    pItalic("medlem i SBR:s entreprenadbesiktningsgrupp"),
  ];
}

function besiktningsmanBlock(): (Paragraph | Table)[] {
  return [
    h2("Besiktningsman"),
    kvTable([["Besiktningsman:", ["{besiktningsman_namn}    utsedd av beställaren"]]]),
  ];
}

function makeDoc(children: (Paragraph | Table)[]): Document {
  return new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: { titlePage: true },
        headers: { default: pageHeader(), first: pageHeader() },
        footers: { default: laterPagesFooter(), first: firstPageFooter() },
        children,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// 1. SLUTBESIKTNING — mirrors the reference slutbesiktning report
// ---------------------------------------------------------------------------

function slutbesiktning(): Document {
  return makeDoc([
    ...titleBlock(),

    h2("Besiktningens omfattning"),
    p("{omfattning}"),

    h2("Tid för besiktningen"),
    p("{tid}"),

    h2("Avtalade arbeten och parter"),
    kvTable([["Avtalsform:", ["{avtalsform}"]]]),
    pUnderline("Parter:"),
    kvTable([
      [
        "Beställare /(Konsument):",
        ["{bestallare_namn}", "{bestallare_adress}", "{bestallare_postnr}"],
      ],
    ]),
    hantverkareTable(),

    ...besiktningsmanBlock(),

    h2("Närvarande"),
    p("Vid besiktningen var parterna representerade av:"),
    kvTable([
      ["för beställaren:", ["{narvarande_bestallare}"]],
      ["för hantverkaren:", ["{narvarande_hantverkare}"]],
    ]),

    h2("Sättet för kallelse till besiktningen"),
    p("Besiktningsmannen har {kallelse_datum} kallat parterna per {kallelse_satt}."),

    h2("Provning, dokumentation"),
    p(
      "Följande dokument över avtalade kvalitetsåtgärder redovisades för granskning i samband med slutbesiktningen:"
    ),
    p(
      "Besiktningsmannen har vid besiktningen bedömt att av entreprenören upprättad dokumentation, som visar att arbetena i fråga är fackmässigt utförda, har utgjort tillräckligt underlag för bedömning av entreprenaden för aktuell del i fråga."
    ),
    pUnderline("Dokumentation:"),
    // Loop tags alone in their own paragraphs so each item becomes its own
    // bullet (inline tags would concatenate all items into one bullet).
    p("{#dokumentation}"),
    bullet("{label} — Daterad: {datum}"),
    p("{/dokumentation}"),

    h2("Fel och förhållanden"),
    p("Under denna rubrik är angivna förhållanden som besiktningsmannen anser utgöra fel."),
    pUnderline("Förklaringar för respektive kolumn:"),
    kvTable([
      ["Bet.", ["Beteckning med markering:", "H anger att besiktningsmannen anser hantverkaren ansvarig för felet"]],
      ["Nr", ["Ordningsnummer på fel / bristfällighet / anmärkning."]],
      ["Del/Rum", ["Bygg- eller installationsdel / alternativt rumsnummer / rumsbenämning"]],
      ["Fel", ["Fel / bristfällighet / anmärkning."]],
      ["Avhjälpt /sign", ["Kolumn för intygande av hantverkaren att avhjälpande har skett med datum och signatur."]],
    ]),
    pUnderline("Övriga förklaringar:"),
    p("{numrering_text}"),
    spacer(),
    felTable(),
    spacer(),

    p(
      "Kostnad för avhjälpande av fel i arbeten som är påtalade av besiktningsmannen bedöms till {kostnad}."
    ),

    h2("Besked om godkännande"),
    p("{godkannande_text}"),
    p("Beslutet meddelades av besiktningsmannen till parterna vid besiktningen."),

    h2("Reklamationsfrister"),
    p("{reklamationsfrister}"),

    h2("Fel skall vara avhjälpta {avhjalpande_deadline}"),

    h2("Övriga noteringar"),
    p("{ovriga_noteringar}"),

    h2("Sändlista"),
    p("Undertecknat utlåtande har {datum} sänts per e-post till parterna och övriga enligt nedan."),
    p("{#sandlista}"),
    bullet("{epost}"),
    p("{/sandlista}"),

    ...signatureBlock(),
  ]);
}

// ---------------------------------------------------------------------------
// 2. STATUSBESIKTNING — mirrors the reference statusbesiktning report
// ---------------------------------------------------------------------------

function statusbesiktning(): Document {
  return makeDoc([
    ...titleBlock(),

    h2("Besiktningens omfattning"),
    p("{omfattning}"),

    h2("Tid för besiktningen"),
    p("{tid}"),

    pUnderline("Beställare"),
    kvTable([
      ["Namn:", ["{bestallare_namn}"]],
      ["Adress:", ["{bestallare_adress}"]],
      ["Postadress", ["{bestallare_postnr}"]],
    ]),

    pUnderline("Fastighetsadress"),
    kvTable([
      ["Objektet:", ["{fastighetsbeteckning}", "{objekt_adress}", "{objekt_postnr}"]],
    ]),

    h2("Besiktningsman"),
    kvTable([["Besiktningsman:", ["{besiktningsman_namn}"]]]),

    h2("Närvarande"),
    kvTable([["Lägenhetsinnehavare:", ["{lagenhetsinnehavare}"]]]),

    h2("Fel och förhållanden"),
    pUnderline("Förklaringar:"),
    p("{numrering_text}"),
    spacer(),
    felTable(),

    h2("Övriga noteringar"),
    p("{ovriga_noteringar}"),

    ...signatureBlock(),

    h2("Bilder"),
    photoGridTable(),
  ]);
}

// ---------------------------------------------------------------------------
// 3. SKADEUTREDNING — mirrors the reference skadeutredning report
// ---------------------------------------------------------------------------

function skadeutredning(): Document {
  return makeDoc([
    ...titleBlock(),

    h2("Tid för besiktningen"),
    p("{besiktning_datum}"),

    h2("Avtalade arbeten och parter"),
    pUnderline("Parter:"),
    kvTable([
      ["Beställare", ["{bestallare_namn}", "{bestallare_adress}", "{bestallare_postnr}"]],
      [
        "Konsultföretag:",
        ["{foretag_namn}", "{foretag_adress}", "{foretag_postadress}", "Org.nr: {foretag_orgnr}"],
      ],
      ["Fastighet/Objekt:", ["{fastighetsbeteckning}", "{objekt_adress}", "{objekt_postnr}"]],
    ]),

    ...besiktningsmanBlock(),

    h2("Närvarande"),
    p("Vid besiktningen var parterna representerade av:"),
    kvTable([["för beställaren:", ["{narvarande_bestallare}"]]]),

    h2("1. Bakgrund till uppdraget"),
    p("{bakgrund}"),

    h2("2. Observationer"),
    p("Vid besiktningstillfället gjordes följande observationer:"),
    p("{#observationer}"),
    bullet("{punkt}"),
    p("{/observationer}"),

    h2("3. Orsak till skada"),
    p("{orsak}"),

    h2("4. Bedömning och bilder"),
    p("{bedomning}"),
    p("Nedan finner ni bilder på skadorna:"),
    p("{#bedomning_bilder}"),
    p("{%bild}"),
    p("{bildtext}"),
    p("{/bedomning_bilder}"),

    h2("5. Rekommendationer / Åtgärdsförslag"),
    p("Vi rekommenderar att nedanstående åtgärder vidtas för att avhjälpa skadan:"),
    p("{#rekommendationer}"),
    pBold("{rubrik}"),
    p("{#punkter}"),
    bullet("{punkt}"),
    p("{/punkter}"),
    p("{/rekommendationer}"),

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
