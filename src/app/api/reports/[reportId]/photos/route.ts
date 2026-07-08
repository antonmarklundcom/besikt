import { NextResponse } from "next/server";
import { z } from "zod";
import { LeadStatus, PhotoSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { storePhotos, MAX_PHOTOS, type IncomingPhoto } from "@/lib/photos";

export const runtime = "nodejs";

const LOCKED: LeadStatus[] = [
  LeadStatus.GODKAND,
  LeadStatus.SKICKAD,
  LeadStatus.ARKIVERAD,
];

async function assertEditable(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { lead: { select: { status: true } } },
  });
  if (!report) return { error: NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 }) };
  if (LOCKED.includes(report.lead.status))
    return { error: NextResponse.json({ error: "Rapporten är låst." }, { status: 409 }) };
  return { report };
}

// POST — upload one or more photos (multipart/form-data). Field "photos" = files,
// optional "section".
export async function POST(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const guard = await assertEditable(params.reportId);
  if ("error" in guard) return guard.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 400 });
  }

  const sectionRaw = form.get("section");
  const section =
    typeof sectionRaw === "string" && sectionRaw in PhotoSection
      ? (sectionRaw as PhotoSection)
      : PhotoSection.BILDER;

  const files = form.getAll("photos").filter((f): f is File => f instanceof File);
  const photos: IncomingPhoto[] = [];
  for (const file of files.slice(0, MAX_PHOTOS)) {
    if (file.size === 0) continue;
    photos.push({ buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type });
  }

  if (photos.length === 0) {
    return NextResponse.json({ error: "Inga giltiga bilder." }, { status: 400 });
  }

  const created = await storePhotos(params.reportId, photos, section);
  return NextResponse.json({ ok: true, photos: created }, { status: 201 });
}

// PATCH — sync photo metadata (caption, section, order) for the report.
const patchSchema = z.object({
  photos: z.array(
    z.object({
      id: z.string().min(1),
      caption: z.string().trim().optional().nullable(),
      section: z.nativeEnum(PhotoSection),
    })
  ),
});

export async function PATCH(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const guard = await assertEditable(params.reportId);
  if ("error" in guard) return guard.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel." }, { status: 422 });
  }

  await prisma.$transaction(
    parsed.data.photos.map((p, i) =>
      prisma.photo.update({
        where: { id: p.id },
        data: { caption: p.caption ?? null, section: p.section, sortOrder: i },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
