import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { generateReportDocx, readGeneratedFile } from "@/lib/generation/generate-docx";
import { isPdfEnabled, convertToPdf } from "@/lib/pdf";
import { absPath, toRelPath } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120; // API-based PDF conversion can take a while

// Generation is only allowed while the report is editable: after Godkänn the
// files are a locked snapshot (§4.3).
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
    include: { lead: { select: { status: true } } },
  });
  if (!report) {
    return NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 });
  }
  if (!ALLOWED.includes(report.lead.status)) {
    return NextResponse.json(
      { error: "Rapporten är låst — dokument kan inte genereras om." },
      { status: 409 }
    );
  }

  try {
    const { docxPath, filename } = await generateReportDocx(
      params.reportId,
      auth.session.user.id
    );

    // Optional auto-convert when a provider is configured.
    let pdf: string | null = null;
    if (isPdfEnabled()) {
      const docx = await readGeneratedFile(docxPath);
      if (docx) {
        try {
          const pdfBuffer = await convertToPdf(docx);
          const pdfAbs = absPath(docxPath).replace(/\.docx$/, ".pdf");
          await fs.writeFile(pdfAbs, pdfBuffer);
          pdf = toRelPath(pdfAbs);
          await prisma.report.update({
            where: { id: params.reportId },
            data: { pdfPath: pdf },
          });
        } catch (err) {
          // PDF failure must not lose the generated docx.
          console.error("PDF conversion failed", err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      filename,
      docx: true,
      pdf: pdf !== null,
      pdfProviderEnabled: isPdfEnabled(),
    });
  } catch (err) {
    console.error("Generation failed for report", params.reportId, err);
    const detail =
      err instanceof Error && err.message ? ` (${err.message.slice(0, 200)})` : "";
    return NextResponse.json(
      { error: `Dokumentgenerering misslyckades${detail}` },
      { status: 500 }
    );
  }
}
