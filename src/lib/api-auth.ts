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

/**
 * Like requireSession() but additionally requires the ADMIN role (§4.4 —
 * Settings and inspector management are admin-only). Enforced in the APIs, not
 * just the page, so a non-admin can't hit the endpoints directly.
 */
export async function requireAdmin(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const auth = await requireSession();
  if ("response" in auth) return auth;
  if (auth.session.user.role !== "ADMIN") {
    return {
      response: NextResponse.json(
        { error: "Endast administratörer." },
        { status: 403 }
      ),
    };
  }
  return auth;
}
