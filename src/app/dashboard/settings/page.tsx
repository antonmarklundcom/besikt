import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";
import { InspectorsManager } from "./inspectors-manager";
import { WebhookSecret } from "./webhook-secret";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Admin gate in the PAGE (the APIs re-check independently, per §4.4).
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  const inspectors = await prisma.inspector.findMany({ orderBy: { name: "asc" } });

  const webhookSecret = process.env.WEBHOOK_SECRET ?? "";

  return (
    <main className="container max-w-3xl py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Inställningar</h1>

      <div className="space-y-8">
        <SettingsForm
          initial={{
            companyName: settings?.companyName ?? "Entreprenadkonsulterna Sthlm AB",
            companyOrgNr: settings?.companyOrgNr ?? "",
            companyAddress: settings?.companyAddress ?? "",
            companyPostal: settings?.companyPostal ?? "",
            companyPhone: settings?.companyPhone ?? "",
            companyEmail: settings?.companyEmail ?? "",
            emailSubjectTmpl:
              settings?.emailSubjectTmpl ?? "Utlåtande {typ} – {objekt}",
            emailBodyTmpl:
              settings?.emailBodyTmpl ??
              "Hej,\n\nBifogat finner ni utlåtande för {objekt}.\n\nMed vänliga hälsningar\n{företag}",
          }}
        />

        <InspectorsManager
          inspectors={inspectors.map((i) => ({
            id: i.id,
            name: i.name,
            title: i.title,
            certBody: i.certBody,
            certNumber: i.certNumber ?? "",
            email: i.email ?? "",
            phone: i.phone ?? "",
            hasSignature: Boolean(i.signatureImagePath),
          }))}
        />

        <WebhookSecret secret={webhookSecret} />
      </div>
    </main>
  );
}
