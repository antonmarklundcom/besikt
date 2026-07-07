import { NextResponse } from "next/server";
import { LeadSource } from "@prisma/client";
import { intakeSchema, createLeadFromIntake } from "@/lib/intake";
import { storePhotos, MAX_PHOTOS, type IncomingPhoto } from "@/lib/photos";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const limited = rateLimit(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "För många försök. Försök igen om en stund." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec ?? 60) } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields. Silently accept to not tip them off.
  const honeypot = form.get("company_website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // Parse contractors (JSON string from the client).
  let contractors: unknown = [];
  const contractorsRaw = form.get("contractors");
  if (typeof contractorsRaw === "string" && contractorsRaw.trim()) {
    try {
      contractors = JSON.parse(contractorsRaw);
    } catch {
      contractors = [];
    }
  }

  const candidate = {
    type: form.get("type"),
    clientName: form.get("clientName"),
    clientEmail: form.get("clientEmail"),
    clientPhone: form.get("clientPhone"),
    clientAddress: form.get("clientAddress"),
    clientPostal: form.get("clientPostal"),
    propertyDesignation: form.get("propertyDesignation"),
    propertyAddress: form.get("propertyAddress"),
    propertyPostal: form.get("propertyPostal"),
    inspectionDate: form.get("inspectionDate"),
    notes: form.get("notes"),
    contractors,
  };

  const parsed = intakeSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Formuläret är ofullständigt.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { leadId, reportId, refNumber } = await createLeadFromIntake(
    parsed.data,
    LeadSource.FORM
  );

  // Collect photo files.
  const photoFiles = form.getAll("photos").filter((f): f is File => f instanceof File);
  const photos: IncomingPhoto[] = [];
  for (const file of photoFiles.slice(0, MAX_PHOTOS)) {
    if (file.size === 0) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    photos.push({ buffer, mimeType: file.type });
  }

  let storedPhotos = 0;
  if (photos.length) {
    try {
      storedPhotos = await storePhotos(reportId, photos);
    } catch (err) {
      // A failed photo shouldn't lose the lead — it's already created.
      console.error("Photo storage failed for report", reportId, err);
    }
  }

  return NextResponse.json({ ok: true, refNumber, leadId, storedPhotos });
}
