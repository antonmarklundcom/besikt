import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

// §4.4 Settings — company block + default email templates. Single-row
// AppSettings table (id = "singleton"). Admin-only.
const schema = z.object({
  companyName: z.string().trim().min(1, "Företagsnamn krävs."),
  companyOrgNr: z.string().trim().optional().nullable(),
  companyAddress: z.string().trim().optional().nullable(),
  companyPostal: z.string().trim().optional().nullable(),
  companyPhone: z.string().trim().optional().nullable(),
  companyEmail: z.string().trim().optional().nullable(),
  emailSubjectTmpl: z.string().trim().min(1, "Ämnesmall krävs."),
  emailBodyTmpl: z.string().min(1, "Meddelandemall krävs."),
});

function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ogiltiga fält." },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const data = {
    companyName: d.companyName.trim(),
    companyOrgNr: emptyToNull(d.companyOrgNr),
    companyAddress: emptyToNull(d.companyAddress),
    companyPostal: emptyToNull(d.companyPostal),
    companyPhone: emptyToNull(d.companyPhone),
    companyEmail: emptyToNull(d.companyEmail),
    emailSubjectTmpl: d.emailSubjectTmpl.trim(),
    emailBodyTmpl: d.emailBodyTmpl,
  };

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json({ ok: true });
}
