import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold">Instrumentpanel</h1>
      <p className="mt-2 text-muted-foreground">
        Inloggad som {session?.user?.name} ({session?.user?.role}).
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Leadkön och redigeraren byggs i fas 2 och 3.
      </p>
    </main>
  );
}
