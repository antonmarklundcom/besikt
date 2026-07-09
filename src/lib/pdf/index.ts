// PDF conversion adapter (§1). OFF by default: PDF_PROVIDER=none means report
// data never leaves the server (GDPR). Providers are API-based because
// Hostinger has no LibreOffice/system binaries. Switch providers via env only.
import { convertWithILovePdf } from "./ilovepdf";
import { convertWithCloudConvert } from "./cloudconvert";

export type PdfProvider = "none" | "ilovepdf" | "cloudconvert";

export class PdfDisabledError extends Error {
  constructor() {
    super(
      "PDF-konvertering är avstängd (PDF_PROVIDER=none). Ladda upp PDF manuellt."
    );
    this.name = "PdfDisabledError";
  }
}

export function pdfProvider(): PdfProvider {
  const raw = (process.env.PDF_PROVIDER ?? "none").toLowerCase();
  if (raw === "ilovepdf" || raw === "cloudconvert") return raw;
  return "none";
}

export function isPdfEnabled(): boolean {
  return pdfProvider() !== "none";
}

/** Convert a .docx buffer to PDF via the configured provider. */
export async function convertToPdf(buffer: Buffer): Promise<Buffer> {
  switch (pdfProvider()) {
    case "ilovepdf":
      return convertWithILovePdf(buffer);
    case "cloudconvert":
      return convertWithCloudConvert(buffer);
    default:
      throw new PdfDisabledError();
  }
}
