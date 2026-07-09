import { NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export const runtime = "nodejs";

// "Godkänn" (§4.3): deliberate, separate action. Locks the report snapshot —
// after this, edit/generate APIs reject with 409. Requires a generated docx.
const ALLOWED: LeadStatus[] = [
  LeadStatus.NY,
  LeadStatus.PAGAENDE,
  LeadStatus.GRANSKNING,
];

export async function POST(
  _req: Request,
  { params }: { params: { reportId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: { lead: { select: { id: true, status: true } } },
  });
  if (!report) {
    return NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 });
  }
  if (!ALLOWED.includes(report.lead.status)) {
    return NextResponse.json(
      { error: "Leaden kan inte godkännas i denna status." },
      { status: 409 }
    );
  }
  if (!report.docxPath) {
    return NextResponse.json(
      { error: "Generera dokumentet innan godkännande." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: report.lead.id },
      data: { status: LeadStatus.GODKAND },
    }),
    prisma.report.update({
      where: { id: report.id },
      data: { approvedAt: new Date(), approvedById: auth.session.user.id },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
