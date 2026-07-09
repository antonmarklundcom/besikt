import { z } from "zod";
import { Prisma, LeadSource, LeadType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextRefNumber } from "@/lib/refnumber";

// ---------------------------------------------------------------------------
// Intake payload (shared by the public form and the GHL webhook)
// ---------------------------------------------------------------------------

const contractorSchema = z.object({
  companyName: z.string().trim().min(1),
  orgNr: z.string().trim().optional().nullable(),
  contactName: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal("")).nullable(),
});

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const intakeSchema = z.object({
  type: z.nativeEnum(LeadType),

  clientName: z.string().trim().min(1, "Beställarens namn krävs"),
  clientEmail: z.preprocess(emptyToUndef, z.string().trim().email().optional()),
  clientPhone: z.preprocess(emptyToUndef, z.string().trim().optional()),
  clientAddress: z.preprocess(emptyToUndef, z.string().trim().optional()),
  clientPostal: z.preprocess(emptyToUndef, z.string().trim().optional()),

  propertyDesignation: z.preprocess(emptyToUndef, z.string().trim().optional()),
  propertyAddress: z.preprocess(emptyToUndef, z.string().trim().optional()),
  propertyPostal: z.preprocess(emptyToUndef, z.string().trim().optional()),

  // Accept YYYY-MM-DD; empty becomes undefined.
  inspectionDate: z.preprocess(
    emptyToUndef,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum måste vara ÅÅÅÅ-MM-DD")
      .optional()
  ),

  notes: z.preprocess(emptyToUndef, z.string().trim().optional()),

  contractors: z.array(contractorSchema).optional().default([]),
});

export type IntakeInput = z.infer<typeof intakeSchema>;

// ---------------------------------------------------------------------------
// Create Lead (status NY) + Report v1 shell + contractors
// ---------------------------------------------------------------------------

export async function createLeadFromIntake(
  input: IntakeInput,
  source: LeadSource
): Promise<{ leadId: string; reportId: string; refNumber: string }> {
  // Only slutbesiktning carries hantverkare.
  const contractors =
    input.type === LeadType.SLUTBESIKTNING ? input.contractors ?? [] : [];

  // Retry on the (rare) refNumber unique collision.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const refNumber = await nextRefNumber(tx);

        const lead = await tx.lead.create({
          data: {
            refNumber,
            type: input.type,
            source,
            clientName: input.clientName,
            clientEmail: input.clientEmail,
            clientPhone: input.clientPhone,
            clientAddress: input.clientAddress,
            clientPostal: input.clientPostal,
            propertyDesignation: input.propertyDesignation,
            propertyAddress: input.propertyAddress,
            propertyPostal: input.propertyPostal,
            inspectionDate: input.inspectionDate
              ? new Date(input.inspectionDate)
              : null,
            notes: input.notes,
            contractors: {
              create: contractors.map((c) => ({
                companyName: c.companyName,
                orgNr: c.orgNr || null,
                contactName: c.contactName || null,
                email: c.email || null,
              })),
            },
            reports: {
              create: { version: 1, dataJson: {} },
            },
          },
          include: { reports: true },
        });

        return {
          leadId: lead.id,
          reportId: lead.reports[0]!.id,
          refNumber: lead.refNumber,
        };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < MAX_ATTEMPTS - 1
      ) {
        continue; // refNumber collided; recompute and retry
      }
      throw err;
    }
  }

  throw new Error("Kunde inte generera referensnummer, försök igen.");
}

// ---------------------------------------------------------------------------
// GHL webhook field mapping — map GoHighLevel field names into IntakeInput.
// Adjust the right-hand keys once the real GHL form field names are known.
// ---------------------------------------------------------------------------

const GHL_TYPE_MAP: Record<string, LeadType> = {
  slutbesiktning: LeadType.SLUTBESIKTNING,
  statusbesiktning: LeadType.STATUSBESIKTNING,
  skadeutredning: LeadType.SKADEUTREDNING,
};

export function mapGhlPayload(body: Record<string, unknown>): unknown {
  const s = (key: string): string | undefined => {
    const v = body[key];
    return typeof v === "string" ? v : v == null ? undefined : String(v);
  };

  const rawType = (s("type") ?? s("uppdragstyp") ?? "").toLowerCase().trim();

  return {
    type: GHL_TYPE_MAP[rawType] ?? rawType.toUpperCase(),
    clientName: s("clientName") ?? s("full_name") ?? s("name"),
    clientEmail: s("clientEmail") ?? s("email"),
    clientPhone: s("clientPhone") ?? s("phone"),
    clientAddress: s("clientAddress") ?? s("address"),
    clientPostal: s("clientPostal") ?? s("postal_code"),
    propertyDesignation: s("propertyDesignation") ?? s("fastighetsbeteckning"),
    propertyAddress: s("propertyAddress") ?? s("objektadress"),
    propertyPostal: s("propertyPostal") ?? s("objekt_postnummer"),
    inspectionDate: s("inspectionDate") ?? s("datum"),
    notes: s("notes") ?? s("meddelande") ?? s("message"),
    contractors: Array.isArray(body.contractors) ? body.contractors : [],
  };
}
