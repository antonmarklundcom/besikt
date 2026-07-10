import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

// §4.4 Inspector profiles CRUD (admin-only). The signature image is uploaded
// separately via /api/inspectors/[id]/signature (multipart).
const schema = z.object({
  name: z.string().trim().min(1, "Namn krävs."),
  title: z.string().trim().optional(),
  certBody: z.string().trim().optional(),
  certNumber: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
});

function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function POST(req: Request) {
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

  const inspector = await prisma.inspector.create({
    data: {
      name: d.name.trim(),
      title: d.title?.trim() || "Certifierad besiktningsman SBR",
      certBody: d.certBody?.trim() || "SBR",
      certNumber: emptyToNull(d.certNumber),
      email: emptyToNull(d.email),
      phone: emptyToNull(d.phone),
    },
  });

  return NextResponse.json({ ok: true, id: inspector.id }, { status: 201 });
}
