/**
 * Prisma singleton for the control app.
 *
 * - Uses a single `PrismaClient` per Node process; in non-production the instance is stored on
 *   `globalThis` so Next.js dev hot-reload does not exhaust DB connections.
 * - Logging: `error`+`warn` in development, `error` only in production.
 * - Consumed by NextAuth adapter, all `src/lib/*` data access, and server actions.
 */
//> Import bindings from a module.
import { PrismaClient } from "@prisma/client";

//> Source statement or expression.
declare global {
  // eslint-disable-next-line no-var
  //> Variable declaration.
  var __prisma: PrismaClient | undefined;
//> Brace or statement terminator.
}

//> Export declaration.
export const prisma: PrismaClient =
  //> Source statement or expression.
  globalThis.__prisma ??
  //> Source statement or expression.
  new PrismaClient({
    //> Source statement or expression.
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  //> Brace or statement terminator.
  });

//> Conditional branch.
if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

