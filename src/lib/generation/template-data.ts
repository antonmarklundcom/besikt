import sharp from "sharp";
import { LeadType, PhotoSection } from "@prisma/client";
import { absPath } from "@/lib/storage";
import { TYPE_LABELS } from "@/lib/labels";

// ---------------------------------------------------------------------------
// Template data — the single source of truth for the placeholder contract.
// Every tag documented in templates/PLACEHOLDERS.md is produced here, and ONLY
// here. The .docx renderer and the HTML preview both consume this, so they
// cannot drift. Placeholder names are ASCII snake_case (no å/ä/ö) on purpose:
// Word autocorrect mangles non-ASCII inside {} tags when users retype them.
//
// Inputs are structural types (not Prisma model imports) so fixtures can drive
// generation without a database (see scripts/smoke-generate.ts).
// ---------------------------------------------------------------------------

export type LeadInput = {
  refNumber: string;
  type: LeadType;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  clientPostal: string | null;
  propertyDesignation: string | null;
  propertyAddress: string | null;
  propertyPostal: string | null;
  inspectionDate: Date | null;
};

export type ContractorInput = {
  companyName: string;
  orgNr: string | null;
  contactName: string | null;
  email: string | null;
};

export type FindingInput = {
  bet: string | null;
  delRum: string | null;
  felText: string;
};

export type QualityDocInput = {
  label: string;
  docDate: Date | null;
};

export type PhotoInput = {
  id: string;
  filePath: string; // relative to cwd (storage convention)
  caption: string | null;
  section: PhotoSection;
};

export type InspectorInput = {
  name: string;
  title: string;
  certNumber: string | null;
  signatureImagePath: string | null;
} | null;

export type SettingsInput = {
  companyName: string;
  companyOrgNr: string | null;
  companyAddress: string | null;
  companyPostal: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
} | null;

export type ReportInput = {
  version: number;
  dataJson: Record<string, unknown>;
};

// Value placed behind every {%bild} / {%signatur} tag. The image module reads
// .path; the HTML preview reads .photoId; width/height are the DISPLAY size in
// px (already scaled).
export type ImageValue = {
  path: string;
  width: number;
  height: number;
  photoId: string | null;
};

export type BildItem = { bild: ImageValue; bildtext: string };

export type CommonData = {
  ref_nummer: string;
  typ_rubrik: string;
  datum: string;
  version: number;
  filnamn: string;

  foretag_namn: string;
  foretag_orgnr: string;
  foretag_adress: string;
  foretag_postadress: string;
  foretag_telefon: string;
  foretag_epost: string;

  bestallare_namn: string;
  bestallare_adress: string;
  bestallare_postnr: string;
  bestallare_epost: string;
  bestallare_telefon: string;

  fastighetsbeteckning: string;
  objekt_adress: string;
  objekt_postnr: string;

  besiktning_datum: string;
  besiktningsman_namn: string;
  besiktningsman_titel: string;
  cert_nummer: string;
  har_signatur: { bild: ImageValue } | false;

  numrering_text: string;
};

export type SlutData = CommonData & {
  hantverkare: { namn: string; orgnr: string; kontakt: string; epost: string }[];
  avtalsform: string;
  narvarande_bestallare: string;
  narvarande_hantverkare: string;
  omfattning: string;
  tid: string;
  kallelse_datum: string;
  kallelse_satt: string;
  dokumentation: { label: string; datum: string }[];
  fel: { bet: string; nr: number; del_rum: string; fel_text: string }[];
  kostnad: string;
  godkand_text: string;
  godkand_datum: string;
  reklamationsfrister: string;
  avhjalpande_deadline: string;
  ovriga_noteringar: string;
  sandlista: { epost: string }[];
};

export type StatusData = CommonData & {
  lagenhetsinnehavare: string;
  omfattning: string;
  tid: string;
  fel: { nr: number; del_rum: string; fel_text: string }[];
  ovriga_noteringar: string;
  bild_rader: { v: BildItem | false; h: BildItem | false }[];
};

export type SkadeData = CommonData & {
  narvarande_bestallare: string;
  bakgrund: string;
  observationer: { punkt: string }[];
  orsak: string;
  bedomning: string;
  bedomning_bilder: BildItem[];
  rekommendationer: { rubrik: string; punkter: { punkt: string }[] }[];
};

export type TemplateData = SlutData | StatusData | SkadeData;

export const NUMRERING_TEXT =
  "Fönster, dörrar, väggar etc. numreras från vänster till höger sett från " +
  "rummets ingång. Vid flera ingångar räknas från huvudentrén.";

// Display widths (px @96dpi) inside the generated document.
const FULL_WIDTH = 440;
const GRID_WIDTH = 250;
const SIGNATURE_WIDTH = 180;

export function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** "35000" | 35000 -> "35 000 kr" (space-thousands, §5). */
export function fmtCurrency(value: unknown): string {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} kr`;
}

/** Objekt slug for filenames: lowercase, åäö→aao, non-alnum→'-'. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/å/g, "a")
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/é/g, "e")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "objekt"
  );
}

export function buildFilename(
  lead: LeadInput,
  version: number,
  ext: "docx" | "pdf"
): string {
  const objekt = slugify(
    lead.propertyDesignation || lead.propertyAddress || "objekt"
  );
  return `${lead.refNumber}_${lead.type}_${objekt}_v${version}.${ext}`;
}

async function imageValue(
  filePath: string,
  photoId: string | null,
  maxWidth: number
): Promise<ImageValue> {
  const path = absPath(filePath);
  let width = maxWidth;
  let height = Math.round((maxWidth * 3) / 4);
  try {
    const meta = await sharp(path).metadata();
    if (meta.width && meta.height) {
      const scale = Math.min(1, maxWidth / meta.width);
      width = Math.round(meta.width * scale);
      height = Math.round(meta.height * scale);
    }
  } catch {
    // Missing/corrupt file: keep the default box; the renderer will still run.
  }
  return { path, width, height, photoId };
}

function str(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === "string" ? v : "";
}

/** Split textarea content into non-empty trimmed lines. */
function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export type BuildInput = {
  lead: LeadInput;
  report: ReportInput;
  contractors: ContractorInput[];
  findings: FindingInput[];
  qualityDocs: QualityDocInput[];
  photos: PhotoInput[];
  inspector: InspectorInput;
  settings: SettingsInput;
};

export async function buildTemplateData(input: BuildInput): Promise<TemplateData> {
  const { lead, report, inspector, settings } = input;
  const d = report.dataJson;

  const har_signatur: CommonData["har_signatur"] =
    inspector?.signatureImagePath
      ? { bild: await imageValue(inspector.signatureImagePath, null, SIGNATURE_WIDTH) }
      : false;

  const common: CommonData = {
    ref_nummer: lead.refNumber,
    typ_rubrik: TYPE_LABELS[lead.type].toUpperCase(),
    datum: fmtDate(new Date()),
    version: report.version,
    filnamn: buildFilename(lead, report.version, "docx"),

    foretag_namn: settings?.companyName ?? "Entreprenadkonsulterna Sthlm AB",
    foretag_orgnr: settings?.companyOrgNr ?? "",
    foretag_adress: settings?.companyAddress ?? "",
    foretag_postadress: settings?.companyPostal ?? "",
    foretag_telefon: settings?.companyPhone ?? "",
    foretag_epost: settings?.companyEmail ?? "",

    bestallare_namn: lead.clientName,
    bestallare_adress: lead.clientAddress ?? "",
    bestallare_postnr: lead.clientPostal ?? "",
    bestallare_epost: lead.clientEmail ?? "",
    bestallare_telefon: lead.clientPhone ?? "",

    fastighetsbeteckning: lead.propertyDesignation ?? "",
    objekt_adress: lead.propertyAddress ?? "",
    objekt_postnr: lead.propertyPostal ?? "",

    besiktning_datum: fmtDate(lead.inspectionDate),
    besiktningsman_namn: inspector?.name ?? "",
    besiktningsman_titel: inspector?.title ?? "Certifierad besiktningsman SBR",
    cert_nummer: inspector?.certNumber ?? "",
    har_signatur,

    numrering_text: NUMRERING_TEXT,
  };

  if (lead.type === LeadType.SLUTBESIKTNING) {
    const data: SlutData = {
      ...common,
      hantverkare: input.contractors.map((c) => ({
        namn: c.companyName,
        orgnr: c.orgNr ?? "",
        kontakt: c.contactName ?? "",
        epost: c.email ?? "",
      })),
      avtalsform: str(d, "avtalsform"),
      narvarande_bestallare: str(d, "narvarandeBestallare"),
      narvarande_hantverkare: str(d, "narvarandeHantverkare"),
      omfattning: str(d, "omfattning"),
      tid: str(d, "tid"),
      kallelse_datum: str(d, "kallelseDate"),
      kallelse_satt: str(d, "kallelseMethod"),
      dokumentation: input.qualityDocs.map((q) => ({
        label: q.label,
        datum: fmtDate(q.docDate),
      })),
      fel: input.findings.map((f, i) => ({
        bet: f.bet ?? "",
        nr: i + 1,
        del_rum: f.delRum ?? "",
        fel_text: f.felText,
      })),
      kostnad: fmtCurrency(d["kostnadAvhjalpande"]),
      godkand_text: d["godkand"] ? "Godkänd" : "Ej godkänd",
      godkand_datum: str(d, "godkandDate"),
      reklamationsfrister: str(d, "reklamationsfrister"),
      avhjalpande_deadline: str(d, "avhjalpandeDeadline"),
      ovriga_noteringar: str(d, "ovrigaNoteringar"),
      sandlista: lines(str(d, "sandlista"))
        .flatMap((l) => l.split(/[;,]/))
        .map((e) => e.trim())
        .filter(Boolean)
        .map((epost) => ({ epost })),
    };
    return data;
  }

  if (lead.type === LeadType.STATUSBESIKTNING) {
    const gridPhotos = input.photos.filter(
      (p) => p.section === PhotoSection.BILDER
    );
    const items: BildItem[] = [];
    for (const p of gridPhotos) {
      items.push({
        bild: await imageValue(p.filePath, p.id, GRID_WIDTH),
        bildtext: p.caption ?? "",
      });
    }
    const bild_rader: StatusData["bild_rader"] = [];
    for (let i = 0; i < items.length; i += 2) {
      bild_rader.push({ v: items[i]!, h: items[i + 1] ?? false });
    }

    const data: StatusData = {
      ...common,
      lagenhetsinnehavare: str(d, "lagenhetsinnehavare"),
      omfattning: str(d, "omfattning"),
      tid: str(d, "tid"),
      fel: input.findings.map((f, i) => ({
        nr: i + 1,
        del_rum: f.delRum ?? "",
        fel_text: f.felText,
      })),
      ovriga_noteringar: str(d, "ovrigaNoteringar"),
      bild_rader,
    };
    return data;
  }

  // SKADEUTREDNING
  const bedomningPhotos = input.photos.filter(
    (p) => p.section === PhotoSection.BEDOMNING
  );
  const bedomning_bilder: BildItem[] = [];
  for (const p of bedomningPhotos) {
    bedomning_bilder.push({
      bild: await imageValue(p.filePath, p.id, FULL_WIDTH),
      bildtext: p.caption ?? "",
    });
  }

  const groupsRaw = Array.isArray(d["rekommendationer"])
    ? (d["rekommendationer"] as { heading?: string; bullets?: string }[])
    : [];

  const data: SkadeData = {
    ...common,
    narvarande_bestallare: str(d, "narvarandeBestallare"),
    bakgrund: str(d, "bakgrund"),
    observationer: lines(str(d, "observationer")).map((punkt) => ({ punkt })),
    orsak: str(d, "orsak"),
    bedomning: str(d, "bedomning"),
    bedomning_bilder,
    rekommendationer: groupsRaw.map((g) => ({
      rubrik: g.heading ?? "",
      punkter: lines(g.bullets ?? "").map((punkt) => ({ punkt })),
    })),
  };
  return data;
}
