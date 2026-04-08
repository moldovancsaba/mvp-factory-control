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
//> Import bindings from a module.
import type { NextAuthOptions } from "next-auth";
//> Import bindings from a module.
import GoogleProvider from "next-auth/providers/google";
//> Import bindings from a module.
import CredentialsProvider from "next-auth/providers/credentials";
//> Import bindings from a module.
import { PrismaAdapter } from "@next-auth/prisma-adapter";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";

//> Function declaration.
function envHasGoogleOAuth() {
  //> Return a value.
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
//> Brace or statement terminator.
}

//> Function declaration.
function envHasDevLogin() {
  //> Return a value.
  return Boolean(process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD);
//> Brace or statement terminator.
}

//> Export declaration.
export const authOptions: NextAuthOptions = {
  //> Source statement or expression.
  adapter: PrismaAdapter(prisma),
  //> Source statement or expression.
  providers: [
    //> Source statement or expression.
    ...(envHasGoogleOAuth()
      //> Source statement or expression.
      ? [
          //> Source statement or expression.
          GoogleProvider({
            //> Source statement or expression.
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            //> Source statement or expression.
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
          //> Delimiter or separator.
          })
        //> Delimiter or separator.
        ]
      //> Source statement or expression.
      : []),
    //> Source statement or expression.
    ...(envHasDevLogin()
      //> Source statement or expression.
      ? [
          //> Source statement or expression.
          CredentialsProvider({
            //> Source statement or expression.
            id: "mvp-factory-control-dev",
            //> Source statement or expression.
            name: "Dev Login",
            //> Source statement or expression.
            credentials: {
              //> Source statement or expression.
              email: { label: "Email", type: "text" },
              //> Source statement or expression.
              password: { label: "Password", type: "password" }
            //> Brace or statement terminator.
            },
            //> Source statement or expression.
            async authorize(credentials) {
              //> Variable declaration.
              const email = String(credentials?.email || "").trim().toLowerCase();
              //> Variable declaration.
              const password = String(credentials?.password || "");

              //> Variable declaration.
              const expectedPassword = String(
                //> Source statement or expression.
                process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD || ""
              //> Delimiter or separator.
              );
              //> Variable declaration.
              const expectedEmail = String(
                //> Source statement or expression.
                process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_EMAIL || ""
              //> Delimiter or separator.
              )
                //> Source statement or expression.
                .trim()
                //> Source statement or expression.
                .toLowerCase();

              //> Conditional branch.
              if (!email || !password) return null;
              //> Conditional branch.
              if (password !== expectedPassword) return null;
              //> Conditional branch.
              if (expectedEmail && email !== expectedEmail) return null;

              //> Variable declaration.
              const user = await prisma.user.upsert({
                //> Source statement or expression.
                where: { email },
                //> Source statement or expression.
                update: { name: "War Room Dev" },
                //> Source statement or expression.
                create: { email, name: "War Room Dev" }
              //> Brace or statement terminator.
              });

              //> Return a value.
              return { id: user.id, email: user.email, name: user.name };
            //> Brace or statement terminator.
            }
          //> Delimiter or separator.
          })
        //> Delimiter or separator.
        ]
      //> Source statement or expression.
      : [])
  //> Delimiter or separator.
  ],
  //> Source statement or expression.
  session: { strategy: "database" },
  //> Source statement or expression.
  pages: {
    //> Source statement or expression.
    signIn: "/signin"
  //> Brace or statement terminator.
  },
  //> Source statement or expression.
  callbacks: {
    //> Source statement or expression.
    async session({ session, user }) {
      //> Conditional branch.
      if (session.user) {
        // Expose the user id for server actions.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //> Source statement or expression.
        (session.user as any).id = user.id;
      //> Brace or statement terminator.
      }
      //> Return a value.
      return session;
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
};
