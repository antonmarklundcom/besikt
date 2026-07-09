import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import {
  generatedDir,
  ensureDir,
  toRelPath,
  absPath,
} from "@/lib/storage";
import { buildTemplateData, buildFilename } from "./template-data";
import { renderDocx } from "./render-docx";

/**
 * Generate the .docx for a report version and persist it.
 * Regeneration overwrites the CURRENT version's files only and clears any
 * previously attached PDF (a stale manual PDF must not outlive the data it was
 * exported from). Previous versions' files are never touched (§5).
 */
export async function generateReportDocx(
  reportId: string,
  userId: string
): Promise<{ docxPath: string; filename: string }> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      lead: { include: { contractors: true } },
      findings: { orderBy: { sortOrder: "asc" } },
      photos: { orderBy: { sortOrder: "asc" } },
      qualityDocs: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) throw new Error("Rapporten hittades inte.");

  // Inspector: the logged-in user's profile if they have one, else the first.
  const inspector =
    (await prisma.inspector.findUnique({ where: { userId } })) ??
    (await prisma.inspector.findFirst({ orderBy: { id: "asc" } }));

  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });

  const data = await buildTemplateData({
    lead: report.lead,
    report: {
      version: report.version,
      dataJson: (report.dataJson ?? {}) as Record<string, unknown>,
    },
    contractors: report.lead.contractors,
    findings: report.findings,
    qualityDocs: report.qualityDocs,
    photos: report.photos,
    inspector,
    settings,
  });

  const buffer = renderDocx(report.lead.type, data);

  const filename = buildFilename(report.lead, report.version, "docx");
  const dir = generatedDir(report.id);
  await ensureDir(dir);
  const absolute = path.join(dir, filename);
  await fs.writeFile(absolute, buffer);

  // Remove stale generated files for THIS version (e.g. after an objekt
  // rename changed the filename) — previous versions live in their own dirs.
  const keep = new Set([filename]);
  for (const entry of await fs.readdir(dir)) {
    if (!keep.has(entry)) {
      await fs.unlink(path.join(dir, entry)).catch(() => {});
    }
  }

  // Clear pdfPath: any earlier manual/auto PDF no longer matches the docx.
  const relPath = toRelPath(absolute);
  await prisma.report.update({
    where: { id: report.id },
    data: { docxPath: relPath, pdfPath: null, generatedAt: new Date() },
  });

  return { docxPath: relPath, filename };
}

/** Read a report's stored generated file (docx or pdf). */
export async function readGeneratedFile(
  relPath: string
): Promise<Buffer | null> {
  try {
    return await fs.readFile(absPath(relPath));
  } catch {
    return null;
  }
}
