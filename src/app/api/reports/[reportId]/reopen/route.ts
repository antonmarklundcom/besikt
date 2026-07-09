import { NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export const runtime = "nodejs";

// Undo an approval — only while the report has NOT been sent. After SKICKAD
// the snapshot must stand; use "Ny version" instead.
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
  if (report.lead.status !== LeadStatus.GODKAND) {
    return NextResponse.json(
      { error: "Endast godkända (ej skickade) leads kan låsas upp." },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: report.lead.id },
      data: { status: LeadStatus.GRANSKNING },
    }),
    prisma.report.update({
      where: { id: report.id },
      data: { approvedAt: null, approvedById: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
