import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { absPath, ensureDir, photosDir, toRelPath } from "@/lib/storage";

export const runtime = "nodejs";

// "Ny version" (§4.3): clones the current report as version+1 for the
// avhjälpande round-trip. Old versions stay read-only with their files.
// Photo FILES are copied (not shared) so deleting one version's storage can
// never break another version.
const ALLOWED: LeadStatus[] = [LeadStatus.GODKAND, LeadStatus.SKICKAD];

export async function POST(
  _req: Request,
  { params }: { params: { leadId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: {
      reports: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          findings: { orderBy: { sortOrder: "asc" } },
          photos: { orderBy: { sortOrder: "asc" } },
          qualityDocs: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!lead || lead.reports.length === 0) {
    return NextResponse.json({ error: "Leaden hittades inte." }, { status: 404 });
  }
  if (!ALLOWED.includes(lead.status)) {
    return NextResponse.json(
      { error: "Ny version kan bara skapas efter godkännande/utskick." },
      { status: 409 }
    );
  }

  const current = lead.reports[0]!;

  // Create the new report row first so we know the target photo directory.
  const newReport = await prisma.report.create({
    data: {
      leadId: lead.id,
      version: current.version + 1,
      dataJson: (current.dataJson ?? {}) as Prisma.InputJsonObject,
      findings: {
        create: current.findings.map((f, i) => ({
          sortOrder: i,
          bet: f.bet,
          delRum: f.delRum,
          felText: f.felText,
          avhjalpt: f.avhjalpt,
          avhjalptSign: f.avhjalptSign,
        })),
      },
      qualityDocs: {
        create: current.qualityDocs.map((q, i) => ({
          sortOrder: i,
          label: q.label,
          docDate: q.docDate,
        })),
      },
    },
  });

  // Copy photo files + rows.
  const targetDir = photosDir(newReport.id);
  await ensureDir(targetDir);
  for (const photo of current.photos) {
    try {
      const filename = `${randomUUID()}.jpg`;
      const target = path.join(targetDir, filename);
      await fs.copyFile(absPath(photo.filePath), target);
      await prisma.photo.create({
        data: {
          reportId: newReport.id,
          filePath: toRelPath(target),
          caption: photo.caption,
          sortOrder: photo.sortOrder,
          section: photo.section,
        },
      });
    } catch (err) {
      // A missing source file shouldn't abort the whole clone.
      console.error("Photo copy failed during new-version", photo.id, err);
    }
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: LeadStatus.PAGAENDE },
  });

  return NextResponse.json(
    { ok: true, reportId: newReport.id, version: newReport.version },
    { status: 201 }
  );
}
