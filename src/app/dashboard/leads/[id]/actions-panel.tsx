"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  leadId: string;
  reportId: string;
  status: LeadStatus;
  hasDocx: boolean;
  hasPdf: boolean;
  approvedAt: string | null;
  sentAt: string | null;
  defaultTo: string[];
  defaultSubject: string;
  defaultBody: string;
};

export function ActionsPanel({
  leadId,
  reportId,
  status,
  hasDocx,
  hasPdf,
  approvedAt,
  sentAt,
  defaultTo,
  defaultSubject,
  defaultBody,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);

  const [to, setTo] = useState(defaultTo.join(", "));
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [attachPdf, setAttachPdf] = useState(hasPdf);
  const [attachDocx, setAttachDocx] = useState(!hasPdf);

  const editable =
    status === LeadStatus.NY ||
    status === LeadStatus.PAGAENDE ||
    status === LeadStatus.GRANSKNING;

  async function call(pathname: string, options?: RequestInit) {
    setError(null);
    setBusy(pathname);
    try {
      const res = await fetch(pathname, { method: "POST", ...options });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Åtgärden misslyckades.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Åtgärden misslyckades.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const recipients = to
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = await call(`/api/reports/${reportId}/send`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipients,
        subject,
        body,
        attachPdf,
        attachDocx,
      }),
    });
    if (ok) setSentOk(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Godkännande & utskick</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editable && (
          <div className="space-y-2">
            <Button
              type="button"
              disabled={!hasDocx || busy !== null}
              onClick={() => {
                if (window.confirm("Godkänn rapporten? Redigering låses.")) {
                  void call(`/api/reports/${reportId}/approve`);
                }
              }}
            >
              {busy?.includes("approve") ? "Godkänner…" : "Godkänn"}
            </Button>
            {!hasDocx && (
              <p className="text-xs text-muted-foreground">
                Generera dokumentet innan godkännande.
              </p>
            )}
          </div>
        )}

        {status === LeadStatus.GODKAND && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-green-700">
                Godkänd {approvedAt ? `(${approvedAt})` : ""} — redigering låst.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => void call(`/api/reports/${reportId}/reopen`)}
              >
                Ångra godkännande
              </Button>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Skicka till kund</p>
              <div className="space-y-2">
                <Label htmlFor="send-to">Mottagare (kommaseparerade)</Label>
                <Input
                  id="send-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="namn@example.com, bygg@firma.se"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-subject">Ämne</Label>
                <Input
                  id="send-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-body">Meddelande</Label>
                <Textarea
                  id="send-body"
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={attachPdf}
                    disabled={!hasPdf}
                    onChange={(e) => setAttachPdf(e.target.checked)}
                  />
                  Bifoga PDF{!hasPdf && " (saknas)"}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={attachDocx}
                    disabled={!hasDocx}
                    onChange={(e) => setAttachDocx(e.target.checked)}
                  />
                  Bifoga .docx
                </label>
              </div>
              <Button
                type="button"
                disabled={busy !== null || (!attachPdf && !attachDocx)}
                onClick={() => {
                  if (window.confirm(`Skicka utlåtandet till: ${to}?`)) {
                    void send();
                  }
                }}
              >
                {busy?.includes("send") ? "Skickar…" : "Skicka"}
              </Button>
            </div>
          </>
        )}

        {status === LeadStatus.SKICKAD && (
          <p className="text-sm text-emerald-700">
            Skickad {sentAt ? `(${sentAt})` : ""}.
          </p>
        )}
        {sentOk && status !== LeadStatus.SKICKAD && (
          <p className="text-sm text-emerald-700">Utskicket är genomfört.</p>
        )}

        {(status === LeadStatus.GODKAND || status === LeadStatus.SKICKAD) && (
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => {
                if (
                  window.confirm(
                    "Skapa ny version? Nuvarande version blir skrivskyddad och en redigerbar kopia skapas."
                  )
                ) {
                  void call(`/api/leads/${leadId}/new-version`);
                }
              }}
            >
              Ny version
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
