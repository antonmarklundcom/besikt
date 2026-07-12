/**
 * Builds the three starter .docx templates with docxtemplater placeholders.
 * Run: npm run templates:build   (output committed under templates/)
 *
 * Styled to match Entreprenadkonsulterna's real reference reports (logos,
 * header/footer layout, party blocks, blue fel-tabell, boilerplate text).
 * The placeholder contract lives in templates/PLACEHOLDERS.md; keep this
 * script, that document and src/lib/generation/template-data.ts in sync.
 *
 * Logos: templates/assets/logo.png (house icon + wordmark, left header) and
 * templates/assets/badge.png (SBR/Bygg­ingenjörerna cert badge, right header
 * on slutbesiktning + statusbesiktning only) are generated as placeholders on
 * first run if missing. Drop the firm's real PNG files at those exact paths
 * and re-run `npm run templates:build` to swap them in — nothing else needs
 * to change.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import sharp from "sharp";
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
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const OUT_DIR = path.resolve(process.cwd(), "templates");
const ASSETS_DIR = path.join(OUT_DIR, "assets");

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

const BLUE = "1F5C99";
const TEXT_DARK = "1A1A1A";
const MUTED = "595959";
const RIGHT_TAB = 9026; // ~A4 content width in twips (1in margins)

// ---------------------------------------------------------------------------
// Placeholder logo assets (generated once; replace the PNG files to rebrand)
// ---------------------------------------------------------------------------

const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="90">
  <g stroke="#333333" stroke-width="4" fill="none">
    <polyline points="8,46 44,14 80,46" />
    <rect x="18" y="46" width="52" height="30" />
    <line x1="44" y1="76" x2="44" y2="58" stroke-width="3" />
  </g>
  <text x="96" y="40" font-family="Georgia,serif" font-size="26" fill="#333333">Entreprenad</text>
  <text x="96" y="66" font-family="Georgia,serif" font-size="26" fill="#333333">konsulterna</text>
  <text x="8" y="88" font-family="Arial" font-size="12" letter-spacing="2" fill="#333333">ENTREPRENADKONSULTERNA.SE</text>
</svg>`;

const BADGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="70">
  <rect width="200" height="70" rx="4" fill="${"#" + BLUE}" />
  <text x="100" y="34" font-family="Arial" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">SBR</text>
  <text x="100" y="54" font-family="Arial" font-size="11" fill="#ffffff" text-anchor="middle">Entreprenadbesiktning</text>
</svg>`;

async function ensureAsset(filename: string, svg: string): Promise<Buffer> {
  const target = path.join(ASSETS_DIR, filename);
  if (existsSync(target)) return readFileSync(target);
  mkdirSync(ASSETS_DIR, { recursive: true });
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(target, buf);
  console.log(`Generated placeholder ${path.relative(process.cwd(), target)} — replace with the real logo and re-run this script.`);
  return buf;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const p = (text: string, opts?: { color?: string; size?: number; italics?: boolean }) =>
  new Paragraph({
    children: [new TextRun({ text, color: opts?.color, size: opts?.size, italics: opts?.italics })],
  });

const pBold = (text: string, size = 22) =>
  new Paragraph({ children: [new TextRun({ text, bold: true, size })] });

const small = (text: string, opts?: { color?: string }) =>
  new Paragraph({ children: [new TextRun({ text, size: 16, color: opts?.color ?? MUTED })] });

/** Bold section header, e.g. "Besiktningens omfattning". */
const h2 = (text: string) =>
  new Paragraph({
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: TEXT_DARK })],
  });

/** Numbered section header for skadeutredning, e.g. "1. Bakgrund till uppdraget". */
const h2num = (text: string) =>
  new Paragraph({
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: TEXT_DARK })],
  });

/** Underlined mini-label, e.g. "Parter:", "Beställare". */
const label = (text: string) =>
  new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text, underline: {} })],
  });

const bullet = (text: string) =>
  new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });

const spacer = () => new Paragraph({ children: [] });

const rule = () =>
  new Paragraph({
    spacing: { before: 60, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
    children: [],
  });

/** "Label ..... value" line with a right-aligned tab stop (dokumentation, sändlista rows). */
function tabLine(left: string, right: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
    children: [new TextRun(`${left}\t${right}`)],
  });
}

// ---------------------------------------------------------------------------
// Header / footer
// ---------------------------------------------------------------------------

function borderlessCell(children: Paragraph[], widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    children,
  });
}

async function pageHeader(withBadge: boolean): Promise<Header> {
  const logo = await ensureAsset("logo.png", LOGO_SVG);
  const logoCell = borderlessCell(
    [
      new Paragraph({
        children: [new ImageRun({ data: logo, transformation: { width: 160, height: 40 }, type: "png" })],
      }),
    ],
    50
  );
  const badgeCell = withBadge
    ? borderlessCell(
        [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: await ensureAsset("badge.png", BADGE_SVG),
                transformation: { width: 90, height: 32 },
                type: "png",
              }),
            ],
          }),
        ],
        30
      )
    : borderlessCell([spacer()], 30);
  const pageCell = borderlessCell(
    [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: ["Sid ", PageNumber.CURRENT, "(", PageNumber.TOTAL_PAGES, ")"],
            size: 16,
            color: MUTED,
          }),
        ],
      }),
    ],
    20
  );

  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "auto" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
          left: { style: BorderStyle.NONE, size: 0, color: "auto" },
          right: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
        },
        rows: [new TableRow({ children: [logoCell, badgeCell, pageCell] })],
      }),
      rule(),
    ],
  });
}

/** First page footer: full company contact block, 2 columns. */
function firstPageFooter(): Footer {
  return new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
          left: { style: BorderStyle.NONE, size: 0, color: "auto" },
          right: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
        },
        rows: [
          new TableRow({
            children: [
              borderlessCell(
                [small("{foretag_namn}"), small("{foretag_adress}"), small("{foretag_postadress}")],
                50
              ),
              borderlessCell(
                [
                  small("Org.nr: {foretag_orgnr}"),
                  small("{foretag_epost}"),
                  small("{foretag_telefon}"),
                ],
                50
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Continuation-page footer: just the filename, per the reference reports. */
function contFooter(): Footer {
  return new Footer({ children: [small("Filnamn: {filnamn}")] });
}

function titleBlock(objektTag: string, typLine: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: objektTag, bold: true, size: 32, color: TEXT_DARK })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: typLine, bold: true, size: 32, color: TEXT_DARK })],
    }),
  ];
}

/** Borderless 2-col label/value row, e.g. "Beställare /(Konsument):" + block. */
function partyRow(labelText: string, valueParas: Paragraph[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          borderlessCell([p(labelText)], 35),
          borderlessCell(valueParas, 65),
        ],
      }),
    ],
  });
}

async function signatureBlock(includeBadge: boolean): Promise<Paragraph[]> {
  const out: Paragraph[] = [
    spacer(),
    p("Stockholm {datum}"),
    spacer(),
    // Image tags must be ALONE in their own paragraph (free image module).
    p("{#har_signatur}"),
    p("{%bild}"),
    p("{/har_signatur}"),
    pBold("{besiktningsman_namn}"),
    p("{besiktningsman_titel}", { italics: true, size: 18 }),
    p("KIWA certifikatnummer: {cert_nummer}", { italics: true, size: 18 }),
  ];
  if (includeBadge) {
    const badge = await ensureAsset("badge.png", BADGE_SVG);
    out.push(
      p("medlem i SBR:s entreprenadbesiktningsgrupp", { italics: true, size: 18 }),
      new Paragraph({
        children: [new ImageRun({ data: badge, transformation: { width: 90, height: 32 }, type: "png" })],
      })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fel-tabell (blue header, matches reference exactly)
// ---------------------------------------------------------------------------

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
};

function headerCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    borders: thinBorder,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: BLUE, color: "auto" },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })] }),
    ],
  });
}

function dataCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    borders: thinBorder,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun(text)] })],
  });
}

/** Fel-tabell: blue header row + one data row carrying the {#fel}…{/fel} loop. */
function felTable(withBet: boolean): Table {
  const headers = withBet
    ? ["Bet.", "Nr", "Del/Rum", "Fel", "Avhjälpt/sign"]
    : ["Nr", "Del/Rum", "Fel", "Avhjälpt/sign"];
  const widths = withBet ? [8, 8, 20, 49, 15] : [8, 24, 53, 15];
  const dataCells = withBet
    ? ["{#fel}{bet}", "{nr}", "{del_rum}", "{fel_text}", "{/fel}"]
    : ["{#fel}{nr}", "{del_rum}", "{fel_text}", "{/fel}"];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((hd, i) => headerCell(hd, widths[i]!)),
      }),
      new TableRow({
        children: dataCells.map((t, i) => dataCell(t, widths[i]!)),
      }),
    ],
  });
}

/** Sändlista table — blue header only, per reference (addresses listed below it). */
function sandlistaHeaderTable(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [headerCell("Företag", 33), headerCell("Namn", 33), headerCell("Adress", 34)],
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

// ---------------------------------------------------------------------------
// Boilerplate text (static — matches the reference reports verbatim; safe to
// edit in Word since none of it contains {tags})
// ---------------------------------------------------------------------------

const FEL_INTRO_WITH_BET: Paragraph[] = [
  p("Under denna rubrik är angivna förhållanden som besiktningsmannen anser utgöra fel."),
  p("Förklaringar för respektive kolumn:", { size: 20 }),
  tabLine("Bet.", "Beteckning: H anger att besiktningsmannen anser hantverkaren ansvarig för felet"),
  tabLine("Nr", "Ordningsnummer på fel / bristfällighet / anmärkning."),
  tabLine("Del/Rum", "Bygg- eller installationsdel / alternativt rumsnummer / rumsbenämning."),
  tabLine("Fel", "Fel / bristfällighet / anmärkning."),
  tabLine("Avhjälpt/sign", "Kolumn för intygande av hantverkaren att avhjälpande har skett med datum och signatur."),
  spacer(),
  p("Övriga förklaringar: {numrering_text}", { size: 20 }),
  spacer(),
];

const FEL_INTRO_NO_BET: Paragraph[] = [
  p("Förklaringar: {numrering_text}", { size: 20 }),
  spacer(),
];

// ---------------------------------------------------------------------------
// Document scaffold
// ---------------------------------------------------------------------------

async function makeDoc(
  withBadgeHeader: boolean,
  children: (Paragraph | Table)[]
): Promise<Document> {
  return new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22, color: TEXT_DARK } },
      },
    },
    sections: [
      {
        properties: { titlePage: true },
        headers: {
          default: await pageHeader(withBadgeHeader),
          first: await pageHeader(withBadgeHeader),
        },
        footers: {
          default: contFooter(),
          first: firstPageFooter(),
        },
        children,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// 1. SLUTBESIKTNING
// ---------------------------------------------------------------------------

async function slutbesiktning(): Promise<Document> {
  return makeDoc(true, [
    ...titleBlock("{fastighetsbeteckning}", "UTLÅTANDE ÖVER {typ_rubrik}"),

    h2("Besiktningens omfattning"),
    p("{omfattning}"),

    h2("Tid för besiktningen"),
    p("{tid}"),

    h2("Avtalade arbeten och parter"),
    partyRow("Avtalsform:", [p("{avtalsform}")]),
    label("Parter:"),
    partyRow("Beställare /(Konsument):", [
      p("{bestallare_namn}"),
      p("{bestallare_adress}"),
      p("{bestallare_postnr}"),
    ]),
    partyRow("Hantverkare /(Näringsidkare):", [
      p("{#hantverkare}{namn}"),
      p("Org.nr: {orgnr}"),
      p("{/hantverkare}"),
    ]),

    h2("Besiktningsman"),
    partyRow("Besiktningsman:", [p("{besiktningsman_namn} — utsedd av beställaren")]),

    h2("Närvarande"),
    p("Vid besiktningen var parterna representerade av:"),
    partyRow("för beställaren:", [p("{narvarande_bestallare}")]),
    partyRow("för hantverkaren:", [p("{narvarande_hantverkare}")]),

    h2("Sättet för kallelse till besiktningen"),
    p("Besiktningsmannen har {kallelse_datum} kallat parterna per {kallelse_satt}."),

    h2("Provning, dokumentation"),
    p(
      "Följande dokument över avtalade kvalitetsåtgärder redovisades för granskning i samband med slutbesiktningen:"
    ),
    p(
      "Besiktningsmannen har vid besiktningen bedömt att av entreprenören upprättad dokumentation, som visar att arbetena i fråga är fackmässigt utförda, har utgjort tillräckligt underlag för bedömning av entreprenaden för aktuell del i fråga."
    ),
    spacer(),
    label("Dokumentation:"),
    p("{#dokumentation}"),
    tabLine("{label}", "Daterad: {datum}"),
    p("{/dokumentation}"),

    h2("Fel och förhållanden"),
    ...FEL_INTRO_WITH_BET,
    felTable(true),

    spacer(),
    p("Kostnad för avhjälpande av fel i arbeten som är påtalade av besiktningsmannen bedöms till {kostnad}."),

    h2("Besked om godkännande"),
    p("Arbetena är: {godkand_text}, {godkand_datum}."),
    p("Beslutet meddelades av besiktningsmannen till parterna vid besiktningen."),

    h2("Reklamationsfrister"),
    p("{reklamationsfrister}"),
    p("Fel skall vara avhjälpta {avhjalpande_deadline}."),

    h2("Övriga noteringar"),
    p("{ovriga_noteringar}"),

    h2("Sändlista"),
    p("Undertecknat utlåtande har {datum} sänts per e-post till parterna och övriga enligt nedan."),
    sandlistaHeaderTable(),
    spacer(),
    p("{#sandlista}{epost}{/sandlista}"),

    ...(await signatureBlock(true)),
  ]);
}

// ---------------------------------------------------------------------------
// 2. STATUSBESIKTNING
// ---------------------------------------------------------------------------

async function statusbesiktning(): Promise<Document> {
  return makeDoc(true, [
    ...titleBlock("{fastighetsbeteckning}", "UTLÅTANDE ÖVER {typ_rubrik}"),

    h2("Besiktningens omfattning"),
    p("{omfattning}"),

    h2("Tid för besiktningen"),
    p("{tid}"),

    label("Beställare"),
    partyRow("Namn:", [p("{bestallare_namn}")]),
    partyRow("Adress:", [p("{bestallare_adress}")]),
    partyRow("Postadress:", [p("{bestallare_postnr}")]),

    label("Fastighetsadress"),
    partyRow("Objektet:", [
      p("{fastighetsbeteckning}"),
      p("{objekt_adress}"),
      p("{objekt_postnr}"),
    ]),

    h2("Besiktningsman"),
    partyRow("Besiktningsman:", [p("{besiktningsman_namn}")]),

    h2("Närvarande"),
    partyRow("Lägenhetsinnehavare:", [p("{lagenhetsinnehavare}")]),

    h2("Fel och förhållanden"),
    ...FEL_INTRO_NO_BET,
    felTable(false),

    h2("Övriga noteringar"),
    p("{ovriga_noteringar}"),

    ...(await signatureBlock(true)),

    h2("Bilder"),
    photoGridTable(),
  ]);
}

// ---------------------------------------------------------------------------
// 3. SKADEUTREDNING
// ---------------------------------------------------------------------------

async function skadeutredning(): Promise<Document> {
  return makeDoc(false, [
    ...titleBlock("{fastighetsbeteckning}", "UTLÅTANDE ÖVER {typ_rubrik}"),

    h2("Tid för besiktningen"),
    p("{tid}"),

    h2("Avtalade arbeten och parter"),
    label("Parter:"),
    partyRow("Beställare:", [
      p("{bestallare_namn}"),
      p("{bestallare_adress}"),
      p("{bestallare_postnr}"),
    ]),
    partyRow("Konsultföretag:", [
      p("{foretag_namn}"),
      p("{foretag_adress}, {foretag_postadress}"),
      p("Org.nr: {foretag_orgnr}"),
    ]),
    partyRow("Fastighet/Objekt:", [
      p("{fastighetsbeteckning}"),
      p("{objekt_adress}"),
      p("{objekt_postnr}"),
    ]),

    h2("Besiktningsman"),
    partyRow("Besiktningsman:", [p("{besiktningsman_namn} — utsedd av beställaren")]),

    h2("Närvarande"),
    p("Vid besiktningen var parterna representerade av:"),
    partyRow("för beställaren:", [p("{narvarande_bestallare}")]),

    h2num("1. Bakgrund till uppdraget"),
    p("{bakgrund}"),

    h2num("2. Observationer"),
    p("Vid besiktningstillfället gjordes följande observationer:"),
    bullet("{#observationer}{punkt}{/observationer}"),

    h2num("3. Orsak till skada"),
    p("{orsak}"),

    h2num("4. Bedömning och bilder"),
    p("{bedomning}"),
    p("Nedan finner ni bilder på skadorna:"),
    p("{#bedomning_bilder}"),
    p("{%bild}"),
    small("{bildtext}"),
    p("{/bedomning_bilder}"),

    h2num("5. Rekommendationer / Åtgärdsförslag"),
    p("Vi rekommenderar att nedanstående åtgärder vidtas för att avhjälpa skadan:"),
    p("{#rekommendationer}"),
    pBold("{rubrik}"),
    bullet("{#punkter}{punkt}{/punkter}"),
    p("{/rekommendationer}"),

    ...(await signatureBlock(false)),
  ]);
}

// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const docs: [string, () => Promise<Document>][] = [
    ["slutbesiktning.docx", slutbesiktning],
    ["statusbesiktning.docx", statusbesiktning],
    ["skadeutredning.docx", skadeutredning],
  ];
  for (const [name, build] of docs) {
    const doc = await build();
    const buf = await Packer.toBuffer(doc);
    writeFileSync(path.join(OUT_DIR, name), buf);
    console.log(`Wrote templates/${name} (${buf.length} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
