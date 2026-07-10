import { NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export const runtime = "nodejs";

// "Arkivera" (§7 GDPR): moves the lead to ARKIVERAD but KEEPS all data and
// files. This is the soft, reversible-in-spirit action; "Radera" is the
// destructive one. Archived leads are locked (editing APIs already 409).
export async function POST(
  _req: Request,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { id: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Leaden hittades inte." }, { status: 404 });
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: LeadStatus.ARKIVERAD },
  });

  return NextResponse.json({ ok: true });
}
