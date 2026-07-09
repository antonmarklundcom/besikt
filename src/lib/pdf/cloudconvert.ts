// CloudConvert docx->pdf via the Jobs API. Plain fetch, no SDK.
// Docs: https://cloudconvert.com/api/v2/jobs

const API = "https://api.cloudconvert.com/v2";

type Job = {
  data: {
    id: string;
    status: string;
    tasks: {
      name: string;
      status: string;
      result?: {
        form?: { url: string; parameters: Record<string, string> };
        files?: { url?: string }[];
      };
    }[];
  };
};

export async function convertWithCloudConvert(docx: Buffer): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) throw new Error("CLOUDCONVERT_API_KEY saknas.");
  const auth = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const createRes = await fetch(`${API}/jobs`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      tasks: {
        upload: { operation: "import/upload" },
        convert: {
          operation: "convert",
          input: "upload",
          input_format: "docx",
          output_format: "pdf",
        },
        export: { operation: "export/url", input: "convert" },
      },
    }),
  });
  if (!createRes.ok) {
    throw new Error(`CloudConvert job create failed (${createRes.status})`);
  }
  const job = (await createRes.json()) as Job;

  const uploadTask = job.data.tasks.find((t) => t.name === "upload");
  const formInfo = uploadTask?.result?.form;
  if (!formInfo) throw new Error("CloudConvert: upload form saknas.");

  const form = new FormData();
  for (const [k, v] of Object.entries(formInfo.parameters)) form.set(k, v);
  form.set(
    "file",
    new Blob([new Uint8Array(docx)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "document.docx"
  );
  const upRes = await fetch(formInfo.url, { method: "POST", body: form });
  if (!upRes.ok) throw new Error(`CloudConvert upload failed (${upRes.status})`);

  // Poll the job until finished (bounded).
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${API}/jobs/${job.data.id}`, {
      headers: { Authorization: auth.Authorization },
    });
    if (!res.ok) throw new Error(`CloudConvert poll failed (${res.status})`);
    const state = (await res.json()) as Job;
    if (state.data.status === "error") {
      throw new Error("CloudConvert-konvertering misslyckades.");
    }
    if (state.data.status === "finished") {
      const exportTask = state.data.tasks.find((t) => t.name === "export");
      const url = exportTask?.result?.files?.[0]?.url;
      if (!url) throw new Error("CloudConvert: exportlänk saknas.");
      const dl = await fetch(url);
      if (!dl.ok) throw new Error(`CloudConvert download failed (${dl.status})`);
      return Buffer.from(await dl.arrayBuffer());
    }
  }
  throw new Error("CloudConvert-konvertering tog för lång tid.");
}
