import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function envHasGithubOAuth() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function envHasDevLogin() {
  return Boolean(process.env.WARROOM_DEV_LOGIN_PASSWORD);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(envHasGithubOAuth()
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID ?? "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? ""
          })
        ]
      : []),
    ...(envHasDevLogin()
      ? [
          CredentialsProvider({
            id: "warroom-dev",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "text" },
              password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
              const email = String(credentials?.email || "").trim().toLowerCase();
              const password = String(credentials?.password || "");

              const expectedPassword = String(
                process.env.WARROOM_DEV_LOGIN_PASSWORD || ""
              );
              const expectedEmail = String(
                process.env.WARROOM_DEV_LOGIN_EMAIL || ""
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
