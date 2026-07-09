import { NextResponse } from "next/server";
import { LeadSource } from "@prisma/client";
import {
  intakeSchema,
  createLeadFromIntake,
  mapGhlPayload,
} from "@/lib/intake";

export const runtime = "nodejs";

// POST /api/webhook/intake — JSON intake for a GHL (GoHighLevel) form.
// Auth via shared secret in the X-Webhook-Secret header (§4.1).
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 }
    );
  }

  const provided = req.headers.get("x-webhook-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = intakeSchema.safeParse(mapGhlPayload(body));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { leadId, refNumber } = await createLeadFromIntake(
    parsed.data,
    LeadSource.GHL
  );

  return NextResponse.json({ ok: true, refNumber, leadId }, { status: 201 });
}
