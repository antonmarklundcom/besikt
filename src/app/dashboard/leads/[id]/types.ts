import type { LeadStatus, LeadType, PhotoSection } from "@prisma/client";

export type LeadScalars = {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientPostal: string;
  propertyDesignation: string;
  propertyAddress: string;
  propertyPostal: string;
  inspectionDate: string;
  notes: string;
};

export type ContractorRow = {
  id: string;
  companyName: string;
  orgNr: string;
  contactName: string;
  email: string;
};

export type FindingRow = {
  id: string;
  bet: string;
  delRum: string;
  felText: string;
  avhjalpt: boolean;
  avhjalptSign: string;
};

export type QualityDocRow = {
  id: string;
  label: string;
  docDate: string;
};

export type PhotoRow = {
  id: string;
  caption: string;
  section: PhotoSection;
};

export type EditorState = {
  reportId: string;
  leadId: string;
  type: LeadType;
  status: LeadStatus;
  version: number;
  lead: LeadScalars;
  dataJson: Record<string, unknown>;
  contractors: ContractorRow[];
  findings: FindingRow[];
  qualityDocs: QualityDocRow[];
  photos: PhotoRow[];
};
