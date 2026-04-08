/**
 * NextAuth.js route handler: exposes `GET` and `POST` for the auth flow under `/api/auth/*`.
 * Configuration lives in `@/lib/auth`.
 */
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

