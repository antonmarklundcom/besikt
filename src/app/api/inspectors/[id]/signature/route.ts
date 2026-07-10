import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin } from "@/lib/api-auth";
import { compressImage } from "@/lib/images";
import {
  inspectorDir,
  writeFileEnsured,
  toRelPath,
  absPath,
  removeFile,
} from "@/lib/storage";
import { MAX_PHOTO_BYTES } from "@/lib/photos";

export const runtime = "nodejs";

const ACCEPTED = /^image\/(jpe?g|png|webp)$/i;

// GET — stream the inspector's signature image (auth required; it lives outside
// /public like all other stored assets). Used by the settings preview.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const inspector = await prisma.inspector.findUnique({
    where: { id: params.id },
  });
  if (!inspector?.signatureImagePath) {
    return NextResponse.json({ error: "Signatur saknas." }, { status: 404 });
  }
  try {
    const data = await fs.readFile(absPath(inspector.signatureImagePath));
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Filen saknas." }, { status: 404 });
  }
}

// POST — upload/replace the signature image (admin-only). Reuses the sharp
// pipeline so it's stored as a compressed JPEG under storage/inspectors/{id}/.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const inspector = await prisma.inspector.findUnique({
    where: { id: params.id },
  });
  if (!inspector) {
    return NextResponse.json({ error: "Besiktningsman hittades inte." }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil bifogad." }, { status: 400 });
  }
  if (!ACCEPTED.test(file.type)) {
    return NextResponse.json({ error: "Endast JPG, PNG eller WEBP." }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Filen är för stor (max 10 MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const compressed = await compressImage(buffer);
  const target = path.join(inspectorDir(params.id), "signature.jpg");
  await writeFileEnsured(target, compressed);

  await prisma.inspector.update({
    where: { id: params.id },
    data: { signatureImagePath: toRelPath(target) },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — remove the signature image and clear the path.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const inspector = await prisma.inspector.findUnique({
    where: { id: params.id },
  });
  if (!inspector) {
    return NextResponse.json({ error: "Besiktningsman hittades inte." }, { status: 404 });
  }
  if (inspector.signatureImagePath) {
    await removeFile(absPath(inspector.signatureImagePath));
    await prisma.inspector.update({
      where: { id: params.id },
      data: { signatureImagePath: null },
    });
  }

  return NextResponse.json({ ok: true });
}
