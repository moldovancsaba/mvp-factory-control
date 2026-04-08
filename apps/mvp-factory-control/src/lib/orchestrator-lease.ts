/**
 * Single-row **orchestrator lease** in Prisma: which process/agent holds the soft lock, TTL, heartbeats.
 *
 * Lease id is constant `ORCHESTRATOR_LEASE_ID`. TTL from `MVP_FACTORY_CONTROL_ORCHESTRATOR_LEASE_TTL_MS`
 * (default 20s, clamped). Health: HEALTHY | EXPIRING | STALE | UNHELD. Consumed by API route and worker UI.
 */
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";

//> Export declaration.
export const ORCHESTRATOR_LEASE_ID = "mvp-factory-control-primary-orchestrator";

//> Export declaration.
export type LeaseHealth = "HEALTHY" | "EXPIRING" | "STALE" | "UNHELD";

//> Export declaration.
export type OrchestratorLeaseSnapshot = {
  //> Source statement or expression.
  leaseId: string;
  //> Source statement or expression.
  ownerId: string | null;
  //> Source statement or expression.
  ownerHost: string | null;
  //> Source statement or expression.
  ownerPid: number | null;
  //> Source statement or expression.
  ownerAgentKey: string | null;
  //> Source statement or expression.
  ownerAgentRole: "ALPHA" | "BETA" | null;
  //> Source statement or expression.
  acquiredAt: Date | null;
  //> Source statement or expression.
  expiresAt: Date | null;
  //> Source statement or expression.
  lastHeartbeatAt: Date | null;
  //> Source statement or expression.
  heartbeatCount: number;
  //> Source statement or expression.
  held: boolean;
  //> Source statement or expression.
  health: LeaseHealth;
  //> Source statement or expression.
  ttlMs: number | null;
  //> Source statement or expression.
  lastAudit: {
    //> Source statement or expression.
    code: string;
    //> Source statement or expression.
    message: string;
    //> Source statement or expression.
    createdAt: Date;
  //> Source statement or expression.
  } | null;
//> Brace or statement terminator.
};

//> Function declaration.
function leaseTtlMs() {
  //> Variable declaration.
  const raw = Number(process.env.MVP_FACTORY_CONTROL_ORCHESTRATOR_LEASE_TTL_MS || "20000");
  //> Conditional branch.
  if (!Number.isFinite(raw)) return 20_000;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(raw), 5_000), 300_000);
//> Brace or statement terminator.
}

//> Function declaration.
function resolveLeaseHealth(params: { ownerId: string | null; ttlMs: number | null }) {
  //> Conditional branch.
  if (!params.ownerId || params.ttlMs === null) return "UNHELD" as const;
  //> Conditional branch.
  if (params.ttlMs <= 0) return "STALE" as const;
  //> Conditional branch.
  if (params.ttlMs <= Math.max(Math.floor(leaseTtlMs() / 4), 5_000)) {
    //> Return a value.
    return "EXPIRING" as const;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return "HEALTHY" as const;
//> Brace or statement terminator.
}

//> Export declaration.
export async function getOrchestratorLeaseSnapshot(): Promise<OrchestratorLeaseSnapshot> {
  //> Await async value.
  await prisma.orchestratorLease.upsert({
    //> Source statement or expression.
    where: { id: ORCHESTRATOR_LEASE_ID },
    //> Source statement or expression.
    create: { id: ORCHESTRATOR_LEASE_ID },
    //> Source statement or expression.
    update: {}
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const lease = await prisma.orchestratorLease.findUnique({
    //> Source statement or expression.
    where: { id: ORCHESTRATOR_LEASE_ID }
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const lastAudit = await prisma.orchestratorLeaseAudit.findFirst({
    //> Source statement or expression.
    where: { leaseId: ORCHESTRATOR_LEASE_ID },
    //> Source statement or expression.
    orderBy: { createdAt: "desc" },
    //> Source statement or expression.
    select: {
      //> Source statement or expression.
      code: true,
      //> Source statement or expression.
      message: true,
      //> Source statement or expression.
      createdAt: true
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const nowMs = Date.now();
  //> Variable declaration.
  const ownerId = lease?.ownerId ?? null;
  //> Variable declaration.
  const ownerAgentRole =
    //> Source statement or expression.
    lease?.ownerAgentKey
      //> Source statement or expression.
      ? (
          //> Await async value.
          await prisma.agent.findFirst({
            //> Source statement or expression.
            where: { key: { equals: lease.ownerAgentKey, mode: "insensitive" } },
            //> Source statement or expression.
            select: { controlRole: true }
          //> Delimiter or separator.
          })
        //> Source statement or expression.
        )?.controlRole ?? null
      //> Source statement or expression.
      : null;
  //> Variable declaration.
  const expiresAt = lease?.expiresAt ?? null;
  //> Variable declaration.
  const ttlMs = expiresAt ? expiresAt.getTime() - nowMs : null;
  //> Variable declaration.
  const held = Boolean(ownerId && ttlMs !== null && ttlMs > 0);

  //> Return a value.
  return {
    //> Source statement or expression.
    leaseId: ORCHESTRATOR_LEASE_ID,
    //> Source statement or expression.
    ownerId,
    //> Source statement or expression.
    ownerHost: lease?.ownerHost ?? null,
    //> Source statement or expression.
    ownerPid: lease?.ownerPid ?? null,
    //> Source statement or expression.
    ownerAgentKey: lease?.ownerAgentKey ?? null,
    //> Source statement or expression.
    ownerAgentRole,
    //> Source statement or expression.
    acquiredAt: lease?.acquiredAt ?? null,
    //> Source statement or expression.
    expiresAt,
    //> Source statement or expression.
    lastHeartbeatAt: lease?.lastHeartbeatAt ?? null,
    //> Source statement or expression.
    heartbeatCount: lease?.heartbeatCount ?? 0,
    //> Source statement or expression.
    held,
    //> Source statement or expression.
    health: resolveLeaseHealth({ ownerId, ttlMs }),
    //> Source statement or expression.
    ttlMs,
    //> Source statement or expression.
    lastAudit: lastAudit
      //> Source statement or expression.
      ? {
          //> Source statement or expression.
          code: lastAudit.code,
          //> Source statement or expression.
          message: lastAudit.message,
          //> Source statement or expression.
          createdAt: lastAudit.createdAt
        //> Brace or statement terminator.
        }
      //> Source statement or expression.
      : null
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
