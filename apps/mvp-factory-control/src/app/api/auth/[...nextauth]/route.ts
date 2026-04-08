/**
 * NextAuth.js route handler: exposes `GET` and `POST` for the auth flow under `/api/auth/*`.
 * Configuration lives in `@/lib/auth`.
 */
//> Import bindings from a module.
import NextAuth from "next-auth";
//> Import bindings from a module.
import { authOptions } from "@/lib/auth";

//> Variable declaration.
const handler = NextAuth(authOptions);

//> Export declaration.
export { handler as GET, handler as POST };

