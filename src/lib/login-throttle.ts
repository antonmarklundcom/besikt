/**
 * Failed-login throttle, keyed by the normalised account email.
 *
 * Deliberately NOT keyed on client IP headers: they are spoofable, and behind a
 * proxy every user can share one IP, so an IP limit could lock real users out.
 * In-memory is enough — the app runs as a single Node process.
 */

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 5000;

type Entry = { count: number; resetAt: number };

export function createLoginThrottle(max = LOGIN_MAX_FAILURES, windowMs = LOGIN_WINDOW_MS) {
  const entries = new Map<string, Entry>();

  function prune(now: number): void {
    for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
    // Still too big (a flood of distinct keys): drop the oldest insertions.
    for (const key of entries.keys()) {
      if (entries.size <= MAX_TRACKED) break;
      entries.delete(key);
    }
  }

  return {
    /** True while this account has used up its failed attempts for the window. */
    isBlocked(key: string, now = Date.now()): boolean {
      const entry = entries.get(key);
      if (!entry) return false;
      if (entry.resetAt <= now) {
        entries.delete(key);
        return false;
      }
      return entry.count >= max;
    },
    recordFailure(key: string, now = Date.now()): void {
      if (entries.size >= MAX_TRACKED) prune(now);
      const entry = entries.get(key);
      if (!entry || entry.resetAt <= now) entries.set(key, { count: 1, resetAt: now + windowMs });
      else entry.count += 1;
    },
    reset(key: string): void {
      entries.delete(key);
    },
  };
}

export const loginThrottle = createLoginThrottle();
