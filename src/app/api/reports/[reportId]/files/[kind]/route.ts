import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { readGeneratedFile } from "@/lib/generation/generate-docx";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

// GET /api/reports/[reportId]/files/docx|pdf — stream a generated/uploaded file.
export async function GET(
  _req: Request,
  { params }: { params: { reportId: string; kind: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const kind = params.kind;
  if (kind !== "docx" && kind !== "pdf") {
    return NextResponse.json({ error: "Ogiltig filtyp." }, { status: 400 });
  }

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    select: { docxPath: true, pdfPath: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 });
  }

  const relPath = kind === "docx" ? report.docxPath : report.pdfPath;
  if (!relPath) {
    return NextResponse.json({ error: "Filen är inte genererad än." }, { status: 404 });
  }

  const data = await readGeneratedFile(relPath);
  if (!data) {
    return NextResponse.json({ error: "Filen saknas på disk." }, { status: 404 });
  }

  const filename = path.basename(relPath);
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[kind]!,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
