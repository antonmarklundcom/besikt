"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function DashboardNav() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="border-b bg-background">
      <div className="container flex h-14 items-center justify-between gap-4">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/dashboard" className="font-semibold">
            Rapportverket
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground"
          >
            Leadkö
          </Link>
          {isAdmin && (
            <Link
              href="/dashboard/settings"
              className="text-muted-foreground hover:text-foreground"
            >
              Inställningar
            </Link>
          )}
        </nav>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Logga ut
        </Button>
      </div>
    </header>
  );
}
