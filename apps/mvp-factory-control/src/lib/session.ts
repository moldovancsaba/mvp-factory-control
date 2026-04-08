/**
 * Thin wrapper around NextAuth `getServerSession` with this app’s `authOptions`.
 *
 * `requireSession()` returns the session when signed in, or `null` (callers typically redirect).
 * Does not enforce RBAC; use `@/lib/rbac` for role-gated server actions and routes.
 */
//> Import bindings from a module.
import { getServerSession } from "next-auth";
//> Import bindings from a module.
import { authOptions } from "@/lib/auth";

/** Resolves the current database-backed session, or `null` if unauthenticated. */
//> Export declaration.
export async function requireSession() {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) {
    //> Return a value.
    return null;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return session;
//> Brace or statement terminator.
}

