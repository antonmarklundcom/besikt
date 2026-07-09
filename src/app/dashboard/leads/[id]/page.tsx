import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { buildTemplateData } from "@/lib/generation/template-data";
import { isPdfEnabled } from "@/lib/pdf";
import { LeadEditor } from "./lead-editor";
import { DocumentPanel } from "./document-panel";
import { HtmlPreview } from "./html-preview";

export const dynamic = "force-dynamic";

const LOCKED: LeadStatus[] = [
  LeadStatus.GODKAND,
  LeadStatus.SKICKAD,
  LeadStatus.ARKIVERAD,
];

export default async function LeadPage({ params }: { params: { id: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      contractors: true,
      reports: {
        orderBy: { version: "desc" },
        include: {
          findings: { orderBy: { sortOrder: "asc" } },
          photos: { orderBy: { sortOrder: "asc" } },
          qualityDocs: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!lead) notFound();

  // Current (highest) version is the editable one; older versions are read-only.
  const current = lead.reports[0]!;

  // Preview data (same builder as the .docx render, so they cannot drift).
  const inspector = await prisma.inspector.findFirst({ orderBy: { id: "asc" } });
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  const previewData = await buildTemplateData({
    lead,
    report: {
      version: current.version,
      dataJson: (current.dataJson ?? {}) as Record<string, unknown>,
    },
    contractors: lead.contractors,
    findings: current.findings,
    qualityDocs: current.qualityDocs,
    photos: current.photos,
    inspector,
    settings,
  });

  const initial = {
    reportId: current.id,
    leadId: lead.id,
    type: lead.type,
    status: lead.status,
    version: current.version,
    lead: {
      clientName: lead.clientName,
      clientEmail: lead.clientEmail ?? "",
      clientPhone: lead.clientPhone ?? "",
      clientAddress: lead.clientAddress ?? "",
      clientPostal: lead.clientPostal ?? "",
      propertyDesignation: lead.propertyDesignation ?? "",
      propertyAddress: lead.propertyAddress ?? "",
      propertyPostal: lead.propertyPostal ?? "",
      inspectionDate: lead.inspectionDate
        ? lead.inspectionDate.toISOString().slice(0, 10)
        : "",
      notes: lead.notes ?? "",
    },
    dataJson: (current.dataJson ?? {}) as Record<string, unknown>,
    contractors: lead.contractors.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      orgNr: c.orgNr ?? "",
      contactName: c.contactName ?? "",
      email: c.email ?? "",
    })),
    findings: current.findings.map((f) => ({
      id: f.id,
      bet: f.bet ?? "",
      delRum: f.delRum ?? "",
      felText: f.felText,
      avhjalpt: f.avhjalpt,
      avhjalptSign: f.avhjalptSign ?? "",
    })),
    qualityDocs: current.qualityDocs.map((d) => ({
      id: d.id,
      label: d.label,
      docDate: d.docDate ? d.docDate.toISOString().slice(0, 10) : "",
    })),
    photos: current.photos.map((p) => ({
      id: p.id,
      caption: p.caption ?? "",
      section: p.section,
    })),
  };

  return (
    <main className="container py-6">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Tillbaka till leadkön
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-lg font-semibold">{lead.refNumber}</h1>
        <Badge className={STATUS_BADGE[lead.status]}>
          {STATUS_LABELS[lead.status]}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {TYPE_LABELS[lead.type]} · v{current.version}
        </span>
      </div>

      <div className="mb-6">
        <DocumentPanel
          reportId={current.id}
          locked={LOCKED.includes(lead.status)}
          hasDocx={Boolean(current.docxPath)}
          hasPdf={Boolean(current.pdfPath)}
          generatedAt={
            current.generatedAt
              ? current.generatedAt.toISOString().slice(0, 16).replace("T", " ")
              : null
          }
          pdfProviderEnabled={isPdfEnabled()}
        />
      </div>

      <details className="mb-6 rounded-lg border">
        <summary className="cursor-pointer select-none p-4 text-sm font-medium">
          Förhandsgranskning (HTML)
        </summary>
        <div className="p-4 pt-0">
          <HtmlPreview type={lead.type} data={previewData} />
        </div>
      </details>

      <LeadEditor initial={initial} />
    </main>
  );
}
