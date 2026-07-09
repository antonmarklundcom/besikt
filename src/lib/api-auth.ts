import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

/**
 * Guard for route handlers. Middleware only covers /dashboard pages, so every
 * mutation API must check the session itself (§7).
 * Returns the session, or a 401 response to return early.
 */
export async function requireSession(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      response: NextResponse.json({ error: "Ej inloggad." }, { status: 401 }),
    };
  }
  return { session };
}
