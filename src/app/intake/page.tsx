import { IntakeForm } from "./intake-form";

export const metadata = {
  title: "Ny förfrågan · Rapportverket",
};

export default function IntakePage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6 sm:py-10">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Ny besiktningsförfrågan
        </h1>
        <p className="text-sm text-muted-foreground">
          Fyll i uppgifterna på plats. Fält markerade med * är obligatoriska.
        </p>
      </div>
      <IntakeForm />
    </main>
  );
}
