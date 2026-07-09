import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { absPath, toRelPath } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

// Manual PDF upload (PDF_PROVIDER=none flow, §1/§4.3): the user exports the
// generated .docx to PDF in Word and attaches it here; it becomes the
// version's pdfPath. Allowed until the lead is sent/archived — uploading the
// Word export happens naturally after Godkänn too, and it does not alter the
// report data snapshot.
const ALLOWED: LeadStatus[] = [
  LeadStatus.NY,
  LeadStatus.PAGAENDE,
  LeadStatus.GRANSKNING,
  LeadStatus.GODKAND,
];

export async function POST(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: { lead: { select: { status: true } } },
  });
  if (!report) {
    return NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 });
  }
  if (!ALLOWED.includes(report.lead.status)) {
    return NextResponse.json({ error: "Rapporten är låst." }, { status: 409 });
  }
  if (!report.docxPath) {
    return NextResponse.json(
      { error: "Generera dokumentet innan du laddar upp PDF." },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 400 });
  }

  const file = form.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Ingen PDF bifogad." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF-filen är för stor (max 25 MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Magic bytes check — don't trust the client's content-type.
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Filen är inte en giltig PDF." }, { status: 400 });
  }

  // Store next to the docx with the same basename.
  const pdfAbs = absPath(report.docxPath).replace(/\.docx$/, ".pdf");
  await fs.writeFile(pdfAbs, buffer);

  const relPath = toRelPath(pdfAbs);
  await prisma.report.update({
    where: { id: params.reportId },
    data: { pdfPath: relPath },
  });

  return NextResponse.json({ ok: true });
}

// Remove the attached PDF (e.g. wrong file uploaded).
export async function DELETE(
  _req: Request,
  { params }: { params: { reportId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: { lead: { select: { status: true } } },
  });
  if (!report) {
    return NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 });
  }
  if (!ALLOWED.includes(report.lead.status)) {
    return NextResponse.json({ error: "Rapporten är låst." }, { status: 409 });
  }
  if (report.pdfPath) {
    await fs.unlink(absPath(report.pdfPath)).catch(() => {});
    await prisma.report.update({
      where: { id: params.reportId },
      data: { pdfPath: null },
    });
  }
  return NextResponse.json({ ok: true });
}
