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
import { ActionsPanel } from "./actions-panel";

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
          emailLogs: { orderBy: { sentAt: "desc" } },
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

  // Send-panel prefills (§4.3): recipients from beställare + contractors,
  // subject/body from the AppSettings templates.
  const objektLabel =
    lead.propertyDesignation || lead.propertyAddress || lead.refNumber;
  const defaultTo = Array.from(
    new Set(
      [lead.clientEmail, ...lead.contractors.map((c) => c.email)]
        .map((e) => e?.trim() ?? "")
        .filter(Boolean)
    )
  );
  const subjectTmpl = settings?.emailSubjectTmpl ?? "Utlåtande {typ} – {objekt}";
  const bodyTmpl =
    settings?.emailBodyTmpl ??
    "Hej,\n\nBifogat finner ni utlåtande för {objekt}.\n\nMed vänliga hälsningar\n{företag}";
  const companyName = settings?.companyName ?? "Entreprenadkonsulterna Sthlm AB";
  const fill = (tmpl: string) =>
    tmpl
      .replaceAll("{typ}", TYPE_LABELS[lead.type])
      .replaceAll("{objekt}", objektLabel)
      .replaceAll("{företag}", companyName);

  const emailLogs = lead.reports.flatMap((r) =>
    r.emailLogs.map((log) => ({ ...log, version: r.version }))
  );

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

      <div className="mb-6">
        <ActionsPanel
          leadId={lead.id}
          reportId={current.id}
          status={lead.status}
          hasDocx={Boolean(current.docxPath)}
          hasPdf={Boolean(current.pdfPath)}
          approvedAt={fmtTs(current.approvedAt)}
          sentAt={fmtTs(current.sentAt)}
          defaultTo={defaultTo}
          defaultSubject={fill(subjectTmpl)}
          defaultBody={fill(bodyTmpl)}
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

      <LeadEditor initial={initial} locked={LOCKED.includes(lead.status)} />

      {lead.reports.length > 1 && (
        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-semibold">Tidigare versioner</h2>
          <ul className="space-y-2">
            {lead.reports.slice(1).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="font-medium">Version {r.version}</span>
                <span className="text-muted-foreground">
                  {r.generatedAt ? `Genererad ${fmtTs(r.generatedAt)}` : "Ej genererad"}
                  {r.sentAt ? ` · Skickad ${fmtTs(r.sentAt)}` : ""}
                </span>
                <span className="flex gap-3">
                  {r.docxPath && (
                    <a
                      href={`/api/reports/${r.id}/files/docx`}
                      className="underline underline-offset-4"
                    >
                      .docx
                    </a>
                  )}
                  {r.pdfPath && (
                    <a
                      href={`/api/reports/${r.id}/files/pdf`}
                      className="underline underline-offset-4"
                    >
                      PDF
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {emailLogs.length > 0 && (
        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-semibold">Utskickshistorik</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-2 font-medium">Datum</th>
                  <th className="p-2 font-medium">Version</th>
                  <th className="p-2 font-medium">Till</th>
                  <th className="p-2 font-medium">Ämne</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log) => (
                  <tr key={log.id} className="border-b align-top">
                    <td className="p-2 whitespace-nowrap">{fmtTs(log.sentAt)}</td>
                    <td className="p-2">v{log.version}</td>
                    <td className="p-2">{log.to.join(", ")}</td>
                    <td className="p-2">{log.subject}</td>
                    <td className="p-2">
                      {log.status === "SENT" ? "Skickad" : log.status === "FAILED" ? "Misslyckad" : "Köad"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function fmtTs(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 16).replace("T", " ") : null;
}
