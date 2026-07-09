import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import { Resend } from "resend";
import { EmailStatus, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { readGeneratedFile } from "@/lib/generation/generate-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  to: z.array(z.string().trim().email()).min(1, "Minst en mottagare krävs."),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  attachPdf: z.boolean().default(false),
  attachDocx: z.boolean().default(false),
});

export async function POST(
  req: Request,
  { params }: { params: { reportId: string } }
) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "E-post är inte konfigurerad (RESEND_API_KEY / MAIL_FROM saknas)." },
      { status: 503 }
    );
  }

  const report = await prisma.report.findUnique({
    where: { id: params.reportId },
    include: { lead: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Rapporten hittades inte." }, { status: 404 });
  }

  // HARD GATE (§6): nothing sends without lead status = GODKAND.
  // Server-side check — the UI state is irrelevant here.
  if (report.lead.status !== LeadStatus.GODKAND) {
    return NextResponse.json(
      { error: "Utskick kräver att leaden är godkänd (Godkänn först)." },
      { status: 403 }
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
  const { to, subject, body, attachPdf, attachDocx } = parsed.data;

  if (!attachPdf && !attachDocx) {
    return NextResponse.json(
      { error: "Välj minst en bilaga (PDF eller .docx)." },
      { status: 400 }
    );
  }

  const attachments: { filename: string; content: Buffer }[] = [];
  if (attachPdf) {
    if (!report.pdfPath) {
      return NextResponse.json(
        { error: "Ingen PDF finns på denna version." },
        { status: 400 }
      );
    }
    const pdf = await readGeneratedFile(report.pdfPath);
    if (!pdf) {
      return NextResponse.json({ error: "PDF-filen saknas på disk." }, { status: 404 });
    }
    attachments.push({ filename: path.basename(report.pdfPath), content: pdf });
  }
  if (attachDocx) {
    if (!report.docxPath) {
      return NextResponse.json(
        { error: "Ingen .docx finns på denna version." },
        { status: 400 }
      );
    }
    const docx = await readGeneratedFile(report.docxPath);
    if (!docx) {
      return NextResponse.json({ error: ".docx-filen saknas på disk." }, { status: 404 });
    }
    attachments.push({ filename: path.basename(report.docxPath), content: docx });
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text: body,
    attachments,
  });

  if (error || !data) {
    await prisma.emailLog.create({
      data: {
        reportId: report.id,
        to,
        subject,
        provider: "resend",
        status: EmailStatus.FAILED,
      },
    });
    console.error("Resend send failed", error);
    return NextResponse.json(
      { error: `Utskicket misslyckades: ${error?.message ?? "okänt fel"}` },
      { status: 502 }
    );
  }

  await prisma.$transaction([
    prisma.emailLog.create({
      data: {
        reportId: report.id,
        to,
        subject,
        provider: "resend",
        providerId: data.id,
        status: EmailStatus.SENT,
      },
    }),
    prisma.report.update({
      where: { id: report.id },
      data: { sentAt: new Date(), sentTo: to },
    }),
    prisma.lead.update({
      where: { id: report.lead.id },
      data: { status: LeadStatus.SKICKAD },
    }),
  ]);

  return NextResponse.json({ ok: true, providerId: data.id });
}
