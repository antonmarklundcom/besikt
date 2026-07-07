import { LeadType, LeadStatus, LeadSource } from "@prisma/client";

export const TYPE_LABELS: Record<LeadType, string> = {
  SLUTBESIKTNING: "Slutbesiktning",
  STATUSBESIKTNING: "Statusbesiktning",
  SKADEUTREDNING: "Skadeutredning",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NY: "Ny",
  PAGAENDE: "Pågående",
  GRANSKNING: "Granskning",
  GODKAND: "Godkänd",
  SKICKAD: "Skickad",
  ARKIVERAD: "Arkiverad",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  FORM: "Webbformulär",
  MANUAL: "Manuell",
  GHL: "GHL",
};

// Tailwind classes for status badges (§4.2 "Status badge colors").
export const STATUS_BADGE: Record<LeadStatus, string> = {
  NY: "bg-blue-100 text-blue-800",
  PAGAENDE: "bg-amber-100 text-amber-800",
  GRANSKNING: "bg-purple-100 text-purple-800",
  GODKAND: "bg-green-100 text-green-800",
  SKICKAD: "bg-emerald-100 text-emerald-800",
  ARKIVERAD: "bg-slate-200 text-slate-700",
};

export const LEAD_TYPES = Object.values(LeadType);
export const LEAD_STATUSES = Object.values(LeadStatus);
