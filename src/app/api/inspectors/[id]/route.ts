import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { removeInspectorDir } from "@/lib/storage";

export const runtime = "nodejs";

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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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

  const existing = await prisma.inspector.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Besiktningsman hittades inte." }, { status: 404 });
  }

  await prisma.inspector.update({
    where: { id: params.id },
    data: {
      name: d.name.trim(),
      title: d.title?.trim() || "Certifierad besiktningsman SBR",
      certBody: d.certBody?.trim() || "SBR",
      certNumber: emptyToNull(d.certNumber),
      email: emptyToNull(d.email),
      phone: emptyToNull(d.phone),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const existing = await prisma.inspector.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Besiktningsman hittades inte." }, { status: 404 });
  }

  await prisma.inspector.delete({ where: { id: params.id } });
  await removeInspectorDir(params.id); // best-effort; force:true never throws

  return NextResponse.json({ ok: true });
}
