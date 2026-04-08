/**
 * Prisma singleton for the control app.
 *
 * - Uses a single `PrismaClient` per Node process; in non-production the instance is stored on
 *   `globalThis` so Next.js dev hot-reload does not exhaust DB connections.
 * - Logging: `error`+`warn` in development, `error` only in production.
 * - Consumed by NextAuth adapter, all `src/lib/*` data access, and server actions.
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

