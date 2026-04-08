/**
 * NextAuth configuration for the internal control app.
 *
 * Providers (enabled only when env vars are present):
 * - Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
 * - Dev credentials: `MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD`; optional `MVP_FACTORY_CONTROL_DEV_LOGIN_EMAIL`
 *
 * Session strategy is **database** (Prisma adapter). The session callback attaches `user.id` onto
 * `session.user` for server actions and RBAC. Custom sign-in page: `/signin`.
 *
 * @see `src/app/api/auth/[...nextauth]/route.ts`
 */
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function envHasGoogleOAuth() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function envHasDevLogin() {
  return Boolean(process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(envHasGoogleOAuth()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
          })
        ]
      : []),
    ...(envHasDevLogin()
      ? [
          CredentialsProvider({
            id: "mvp-factory-control-dev",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "text" },
              password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
              const email = String(credentials?.email || "").trim().toLowerCase();
              const password = String(credentials?.password || "");

              const expectedPassword = String(
                process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD || ""
              );
              const expectedEmail = String(
                process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_EMAIL || ""
              )
                .trim()
                .toLowerCase();

              if (!email || !password) return null;
              if (password !== expectedPassword) return null;
              if (expectedEmail && email !== expectedEmail) return null;

              const user = await prisma.user.upsert({
                where: { email },
                update: { name: "War Room Dev" },
                create: { email, name: "War Room Dev" }
              });

              return { id: user.id, email: user.email, name: user.name };
            }
          })
        ]
      : [])
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/signin"
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        // Expose the user id for server actions.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = user.id;
      }
      return session;
    }
  }
};
