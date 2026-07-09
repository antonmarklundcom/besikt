// iLovePDF officepdf conversion (EU-based provider, DPA available).
// Flow: auth (public key -> JWT) -> start task -> upload -> process -> download.
// Plain fetch, no SDK. Docs: https://developer.ilovepdf.com/docs/api-reference

const API = "https://api.ilovepdf.com/v1";

async function json<T>(res: Response, step: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`iLovePDF ${step} failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function convertWithILovePdf(docx: Buffer): Promise<Buffer> {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  if (!publicKey) throw new Error("ILOVEPDF_PUBLIC_KEY saknas.");

  const { token } = await json<{ token: string }>(
    await fetch(`${API}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey }),
    }),
    "auth"
  );
  const auth = { Authorization: `Bearer ${token}` };

  const { server, task } = await json<{ server: string; task: string }>(
    await fetch(`${API}/start/officepdf`, { headers: auth }),
    "start"
  );
  const base = `https://${server}/v1`;

  const form = new FormData();
  form.set("task", task);
  form.set(
    "file",
    new Blob([new Uint8Array(docx)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "document.docx"
  );
  const { server_filename } = await json<{ server_filename: string }>(
    await fetch(`${base}/upload`, { method: "POST", headers: auth, body: form }),
    "upload"
  );

  await json(
    await fetch(`${base}/process`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        tool: "officepdf",
        files: [{ server_filename, filename: "document.docx" }],
      }),
    }),
    "process"
  );

  const dl = await fetch(`${base}/download/${task}`, { headers: auth });
  if (!dl.ok) throw new Error(`iLovePDF download failed (${dl.status})`);
  return Buffer.from(await dl.arrayBuffer());
}
