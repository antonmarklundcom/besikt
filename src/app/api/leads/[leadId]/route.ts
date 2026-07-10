import { NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { removeReportDir } from "@/lib/storage";

export const runtime = "nodejs";

// "Radera" (§7 GDPR): irreversibly deletes all personal data + files but keeps
// an anonymised ledger row (refNumber, type, timestamps) so reference-number
// sequences and audit history stay intact. Steps:
//   1. Delete every report's storage dir (photos + generated docx/pdf) on disk.
//   2. Delete Report rows (cascades Findings/Photos/QualityDocs/EmailLogs) and
//      Contractor rows.
//   3. Anonymise the Lead row and set status ARKIVERAD.
export async function DELETE(
  _req: Request,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: { reports: { select: { id: true } } },
  });
  if (!lead) {
    return NextResponse.json({ error: "Leaden hittades inte." }, { status: 404 });
  }

  // Files first (best-effort; removeReportDir uses force:true so ENOENT is fine).
  for (const report of lead.reports) {
    await removeReportDir(report.id);
  }

  await prisma.$transaction([
    // Cascades take care of Finding/Photo/QualityDoc/EmailLog rows.
    prisma.report.deleteMany({ where: { leadId: lead.id } }),
    prisma.contractor.deleteMany({ where: { leadId: lead.id } }),
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: LeadStatus.ARKIVERAD,
        clientName: "Raderad",
        clientEmail: null,
        clientPhone: null,
        clientAddress: null,
        clientPostal: null,
        propertyDesignation: null,
        propertyAddress: null,
        propertyPostal: null,
        notes: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
