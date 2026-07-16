// Self-hosted Gotenberg (LibreOffice-based docx->pdf conversion). Open source,
// runs on infrastructure the firm controls (Cloud Run, a small VPS, …) instead
// of a third-party PDF SaaS — no per-conversion vendor fees, data stays on
// infra you own. https://gotenberg.dev/docs/routes#office-documents-route
//
// Gotenberg itself has no built-in auth. If GOTENBERG_SECRET is set, it's
// sent as the X-Gotenberg-Secret header — put a matching check in front of
// the Gotenberg container (a tiny reverse-proxy rule, Cloud Run ingress
// config, etc.) if it's reachable from the public internet.

export async function convertWithGotenberg(docx: Buffer): Promise<Buffer> {
  const url = process.env.GOTENBERG_URL;
  if (!url) throw new Error("GOTENBERG_URL saknas.");

  const form = new FormData();
  form.set(
    "files",
    new Blob([new Uint8Array(docx)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "document.docx"
  );

  const secret = process.env.GOTENBERG_SECRET;
  const res = await fetch(`${url.replace(/\/$/, "")}/forms/libreoffice/convert`, {
    method: "POST",
    headers: secret ? { "X-Gotenberg-Secret": secret } : undefined,
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gotenberg convert failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
