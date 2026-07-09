import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { absPath, removeFile } from "@/lib/storage";

export const runtime = "nodejs";

const LOCKED: LeadStatus[] = [
  LeadStatus.GODKAND,
  LeadStatus.SKICKAD,
  LeadStatus.ARKIVERAD,
];

// GET — stream the stored (already-compressed) JPEG. Auth required; photos live
// outside /public for GDPR reasons (§1, §7).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const photo = await prisma.photo.findUnique({ where: { id: params.id } });
  if (!photo) {
    return NextResponse.json({ error: "Bilden hittades inte." }, { status: 404 });
  }

  try {
    const data = await fs.readFile(absPath(photo.filePath));
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Filen saknas." }, { status: 404 });
  }
}

// DELETE — remove the row and unlink the file from disk.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const photo = await prisma.photo.findUnique({
    where: { id: params.id },
    include: { report: { include: { lead: { select: { status: true } } } } },
  });
  if (!photo) {
    return NextResponse.json({ error: "Bilden hittades inte." }, { status: 404 });
  }
  if (LOCKED.includes(photo.report.lead.status)) {
    return NextResponse.json({ error: "Rapporten är låst." }, { status: 409 });
  }

  await removeFile(absPath(photo.filePath));
  await prisma.photo.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
