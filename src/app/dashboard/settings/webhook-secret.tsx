"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Display-only (§4.4). The secret is set via the WEBHOOK_SECRET env var; the
// intake webhook validates it in the X-Webhook-Secret header.
export function WebhookSecret({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable over http — ignore
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook-hemlighet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Skickas som <code>X-Webhook-Secret</code> från GHL till{" "}
          <code>/api/webhook/intake</code>. Ändras via miljövariabeln{" "}
          <code>WEBHOOK_SECRET</code>.
        </p>
        {secret ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded border bg-muted px-2 py-1 text-sm">
              {revealed ? secret : "•".repeat(Math.min(secret.length, 24))}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => setRevealed((r) => !r)}>
              {revealed ? "Dölj" : "Visa"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? "Kopierad" : "Kopiera"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-destructive">
            Ingen <code>WEBHOOK_SECRET</code> är satt i miljön.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
