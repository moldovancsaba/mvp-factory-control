/**
 * Thin wrapper around NextAuth `getServerSession` with this app’s `authOptions`.
 *
 * `requireSession()` returns the session when signed in, or `null` (callers typically redirect).
 * Does not enforce RBAC; use `@/lib/rbac` for role-gated server actions and routes.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Resolves the current database-backed session, or `null` if unauthenticated. */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }
  return session;
}

