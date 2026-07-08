import { NextResponse } from "next/server";
import { z } from "zod";
import { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export const runtime = "nodejs";

// Statuses in which a report is locked against edits (§4.3 Godkänn locks a
// snapshot; sent/archived are terminal).
const LOCKED: LeadStatus[] = [
  LeadStatus.GODKAND,
  LeadStatus.SKICKAD,
  LeadStatus.ARKIVERAD,
];

const nullableStr = z.string().trim().optional().nullable();

const leadScalars = z
  .object({
    clientName: z.string().trim().min(1).optional(),
    clientEmail: nullableStr,
    clientPhone: nullableStr,
    clientAddress: nullableStr,
    clientPostal: nullableStr,
    propertyDesignation: nullableStr,
    propertyAddress: nullableStr,
    propertyPostal: nullableStr,
    inspectionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notes: nullableStr,
  })
  .partial();

const contractorSchema = z.object({
  id: z.string().min(1),
  companyName: z.string().trim().default(""),
  orgNr: nullableStr,
  contactName: nullableStr,
  email: nullableStr,
});

const findingSchema = z.object({
  id: z.string().min(1),
  bet: nullableStr,
  delRum: nullableStr,
  felText: z.string().default(""),
  avhjalpt: z.boolean().default(false),
  avhjalptSign: nullableStr,
});

const qualityDocSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().default(""),
  docDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

const bodySchema = z.object({
  lead: leadScalars.optional(),
  dataJson: z.record(z.unknown()).optional(),
  contractors: z.array(contractorSchema).optional(),
  findings: z.array(findingSchema).optional(),
  qualityDocs: z.array(qualityDocSchema).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: { lead: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 });
  }
  if (LOCKED.includes(report.lead.status)) {
    return NextResponse.json(
      { error: "Rapporten är låst och kan inte ändras." },
      { status: 409 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valideringsfel.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { lead, dataJson, contractors, findings, qualityDocs } = parsed.data;
  const leadId = report.leadId;
  const reportId = report.id;

  await prisma.$transaction(async (tx) => {
    // Lead scalar fields + first-edit status bump (NY -> PAGAENDE).
    if (lead) {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          ...lead,
          inspectionDate:
            lead.inspectionDate === undefined
              ? undefined
              : lead.inspectionDate
                ? new Date(lead.inspectionDate)
                : null,
        },
      });
    }
    if (report.lead.status === LeadStatus.NY) {
      await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.PAGAENDE },
      });
    }

    if (dataJson !== undefined) {
      await tx.report.update({
        where: { id: reportId },
        data: { dataJson: dataJson as Prisma.InputJsonObject },
      });
    }

    if (contractors) {
      const ids = contractors.map((c) => c.id);
      await tx.contractor.deleteMany({
        where: { leadId, id: { notIn: ids.length ? ids : ["__none__"] } },
      });
      for (const c of contractors) {
        await tx.contractor.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            leadId,
            companyName: c.companyName,
            orgNr: c.orgNr ?? null,
            contactName: c.contactName ?? null,
            email: c.email ?? null,
          },
          update: {
            companyName: c.companyName,
            orgNr: c.orgNr ?? null,
            contactName: c.contactName ?? null,
            email: c.email ?? null,
          },
        });
      }
    }

    if (findings) {
      const ids = findings.map((f) => f.id);
      await tx.finding.deleteMany({
        where: { reportId, id: { notIn: ids.length ? ids : ["__none__"] } },
      });
      for (let i = 0; i < findings.length; i++) {
        const f = findings[i]!;
        await tx.finding.upsert({
          where: { id: f.id },
          create: {
            id: f.id,
            reportId,
            sortOrder: i,
            bet: f.bet ?? null,
            delRum: f.delRum ?? null,
            felText: f.felText,
            avhjalpt: f.avhjalpt,
            avhjalptSign: f.avhjalptSign ?? null,
          },
          update: {
            sortOrder: i,
            bet: f.bet ?? null,
            delRum: f.delRum ?? null,
            felText: f.felText,
            avhjalpt: f.avhjalpt,
            avhjalptSign: f.avhjalptSign ?? null,
          },
        });
      }
    }

    if (qualityDocs) {
      const ids = qualityDocs.map((d) => d.id);
      await tx.qualityDoc.deleteMany({
        where: { reportId, id: { notIn: ids.length ? ids : ["__none__"] } },
      });
      for (let i = 0; i < qualityDocs.length; i++) {
        const d = qualityDocs[i]!;
        await tx.qualityDoc.upsert({
          where: { id: d.id },
          create: {
            id: d.id,
            reportId,
            sortOrder: i,
            label: d.label,
            docDate: d.docDate ? new Date(d.docDate) : null,
          },
          update: {
            sortOrder: i,
            label: d.label,
            docDate: d.docDate ? new Date(d.docDate) : null,
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
