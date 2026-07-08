import { LeadType, PhotoSection } from "@prisma/client";

// Type-specific report payload stored in Report.dataJson (§3). Kept loose so the
// Prisma schema stays stable across the three report types.

export type RekommendationGroup = {
  heading: string;
  bullets: string; // one bullet per line (split at generation time)
};

export type ReportData = {
  // slutbesiktning
  omfattning?: string;
  tid?: string;
  kallelseDate?: string;
  kallelseMethod?: string;
  kostnadAvhjalpande?: string; // SEK, digits only
  godkand?: boolean;
  godkandDate?: string;
  reklamationsfrister?: string;
  avhjalpandeDeadline?: string;
  ovrigaNoteringar?: string;
  sandlista?: string; // newline/comma separated emails

  // statusbesiktning
  lagenhetsinnehavare?: string;

  // skadeutredning
  bakgrund?: string;
  observationer?: string; // one bullet per line
  orsak?: string;
  bedomning?: string;
  rekommendationer?: RekommendationGroup[];
};

export function emptyReportData(): ReportData {
  return {};
}

// Which photo sections are relevant per report type (Bilder tab).
export function photoSectionsFor(type: LeadType): PhotoSection[] {
  switch (type) {
    case LeadType.SKADEUTREDNING:
      return [PhotoSection.BEDOMNING, PhotoSection.OBSERVATION, PhotoSection.OVRIGT];
    case LeadType.STATUSBESIKTNING:
      return [PhotoSection.BILDER, PhotoSection.OVRIGT];
    default:
      return [PhotoSection.BILDER, PhotoSection.OVRIGT];
  }
}

export const PHOTO_SECTION_LABELS: Record<PhotoSection, string> = {
  BILDER: "Bilder",
  BEDOMNING: "Bedömning (avsnitt 4)",
  OBSERVATION: "Observationer",
  OVRIGT: "Övrigt",
};
