// Simple in-memory IP rate limiter for the public intake endpoint (§7).
// Volume is tiny (5–10 reports/week) so an in-memory sliding window per server
// instance is sufficient. Resets on restart — acceptable per the brief.

type Bucket = number[]; // timestamps (ms)

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_HITS = 10; // per window per IP

export function rateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const hits = (buckets.get(ip) ?? []).filter((t) => t > cutoff);

  if (hits.length >= MAX_HITS) {
    const retryAfterSec = Math.ceil((hits[0] + WINDOW_MS - now) / 1000);
    buckets.set(ip, hits);
    return { ok: false, retryAfterSec };
  }

  hits.push(now);
  buckets.set(ip, hits);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 500) {
    for (const [key, val] of buckets) {
      const live = val.filter((t) => t > cutoff);
      if (live.length === 0) buckets.delete(key);
      else buckets.set(key, live);
    }
  }

  return { ok: true };
}

/** Best-effort client IP from proxy headers (Hostinger sits behind a proxy). */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
