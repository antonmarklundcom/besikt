import { readFileSync } from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import { LeadType } from "@prisma/client";
import type { ImageValue, TemplateData } from "./template-data";

const TEMPLATE_FILES: Record<LeadType, string> = {
  SLUTBESIKTNING: "slutbesiktning.docx",
  STATUSBESIKTNING: "statusbesiktning.docx",
  SKADEUTREDNING: "skadeutredning.docx",
};

export function templatePath(type: LeadType): string {
  return path.resolve(process.cwd(), "templates", TEMPLATE_FILES[type]);
}

// The free image module only supports STRING tag values (an object is assumed
// to be its internal pre-resolved form and crashes). TemplateData carries
// structured ImageValue objects for the HTML preview, so we encode them to
// "path|width|height" strings for the docx render pass.
const IMG_SEP = "|";

function isImageValue(v: unknown): v is ImageValue {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    "path" in v &&
    "width" in v &&
    "height" in v
  );
}

function encodeImages<T>(value: T): T {
  if (isImageValue(value)) {
    return `${value.path}${IMG_SEP}${value.width}${IMG_SEP}${value.height}` as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(encodeImages) as unknown as T;
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = encodeImages(v);
    return out as unknown as T;
  }
  return value;
}

function parseTag(tagValue: unknown): { path: string; width: number; height: number } | null {
  if (typeof tagValue !== "string") return null;
  const parts = tagValue.split(IMG_SEP);
  if (parts.length < 3) return null;
  const width = Number(parts[parts.length - 2]);
  const height = Number(parts[parts.length - 1]);
  const p = parts.slice(0, -2).join(IMG_SEP);
  if (!p || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { path: p, width, height };
}

// 1x1 transparent PNG — used if an image file went missing so rendering never
// hard-fails on a lost photo.
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Render a report .docx from its committed template + template data.
 * Throws docxtemplater's multi-error with tag context if the template has been
 * restyled in a way that broke a tag.
 */
export function renderDocx(type: LeadType, data: TemplateData): Buffer {
  const zip = new PizZip(readFileSync(templatePath(type)));

  const imageModule = new ImageModule({
    centered: false,
    fileType: "docx",
    getImage: (tagValue: unknown) => {
      const parsed = parseTag(tagValue);
      if (!parsed) return BLANK_PNG;
      try {
        return readFileSync(parsed.path);
      } catch {
        return BLANK_PNG;
      }
    },
    getSize: (_img: Buffer, tagValue: unknown) => {
      const parsed = parseTag(tagValue);
      return parsed ? [parsed.width, parsed.height] : [1, 1];
    },
  });

  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    // Missing keys render as empty string instead of throwing — a restyled
    // template with a removed tag must not block generation.
    nullGetter: () => "",
  });

  doc.render(encodeImages(data) as unknown as Record<string, unknown>);

  return doc
    .getZip()
    .generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
