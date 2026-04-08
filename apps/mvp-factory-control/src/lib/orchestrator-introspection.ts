/**
 * **Read-only** snapshot for dashboards: orchestrator lease health + alpha context locks + queue/task stats.
 *
 * Aggregates `orchestrator-lease`, `alpha-context` active locks, and Prisma counts into a single JSON-safe
 * object for `src/app/api/orchestrator/state` and server-rendered dashboard sections.
 */
//> Import bindings from a module.
import { getOrchestratorLeaseSnapshot } from "@/lib/orchestrator-lease";
//> Import bindings from a module.
import { listActiveProjectAlphaLocks } from "@/lib/alpha-context";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";

//> Export declaration.
export type IntrospectionState = "OK" | "STALE" | "MISSING" | "UNKNOWN";

//> Export declaration.
export type OrchestratorIntrospectionSnapshot = {
  //> Source statement or expression.
  generatedAt: string;
  //> Source statement or expression.
  lease: {
    //> Source statement or expression.
    state: IntrospectionState;
    //> Source statement or expression.
    reason: string;
    //> Source statement or expression.
    ownerId: string | null;
    //> Source statement or expression.
    ownerAgentKey: string | null;
    //> Source statement or expression.
    ownerAgentRole: "ALPHA" | "BETA" | null;
    //> Source statement or expression.
    health: "HEALTHY" | "EXPIRING" | "STALE" | "UNHELD";
    //> Source statement or expression.
    ttlMs: number | null;
    //> Source statement or expression.
    lastHeartbeatAt: string | null;
    //> Source statement or expression.
    acquiredAt: string | null;
    //> Source statement or expression.
    lastAuditCode: string | null;
  //> Brace or statement terminator.
  };
  //> Source statement or expression.
  contextLocks: {
    //> Source statement or expression.
    state: IntrospectionState;
    //> Source statement or expression.
    reason: string;
    //> Source statement or expression.
    totalActiveLocks: number;
    //> Source statement or expression.
    blockedLocks: number;
    //> Source statement or expression.
    warningLocks: number;
    //> Source statement or expression.
    activeOwners: string[];
  //> Brace or statement terminator.
  };
  //> Source statement or expression.
  tasks: {
    //> Source statement or expression.
    state: IntrospectionState;
    //> Source statement or expression.
    reason: string;
    //> Source statement or expression.
    totalOpen: number;
    //> Source statement or expression.
    queued: number;
    //> Source statement or expression.
    running: number;
    //> Source statement or expression.
    manualRequired: number;
    //> Source statement or expression.
    deadLetter: number;
    //> Source statement or expression.
    done: number;
    //> Source statement or expression.
    oldestQueuedAt: string | null;
    //> Source statement or expression.
    oldestRunningAt: string | null;
    //> Source statement or expression.
    staleRunningCount: number;
  //> Brace or statement terminator.
  };
  //> Source statement or expression.
  failures: {
    //> Source statement or expression.
    state: IntrospectionState;
    //> Source statement or expression.
    reason: string;
    //> Source statement or expression.
    totalRecent: number;
    //> Source statement or expression.
    highSeverityRecent: number;
    //> Source statement or expression.
    latestFailureClass: string | null;
  //> Brace or statement terminator.
  };
  //> Source statement or expression.
  errors: Array<{
    //> Source statement or expression.
    component: "LEASE" | "CONTEXT" | "TASKS" | "FAILURES";
    //> Source statement or expression.
    message: string;
  //> Delimiter or separator.
  }>;
//> Brace or statement terminator.
};

//> Function declaration.
function isoOrNull(value: Date | null | undefined) {
  //> Return a value.
  return value instanceof Date ? value.toISOString() : null;
//> Brace or statement terminator.
}

//> Function declaration.
function staleRunningThresholdMs() {
  //> Variable declaration.
  const leaseTtl = Number(process.env.MVP_FACTORY_CONTROL_ORCHESTRATOR_LEASE_TTL_MS || "20000");
  //> Variable declaration.
  const fallback = Math.max((Number.isFinite(leaseTtl) ? leaseTtl : 20_000) * 2, 30_000);
  //> Variable declaration.
  const raw = Number(process.env.MVP_FACTORY_CONTROL_ORCHESTRATOR_STALE_RUNNING_MS || String(fallback));
  //> Conditional branch.
  if (!Number.isFinite(raw)) return fallback;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(raw), 5_000), 3_600_000);
//> Brace or statement terminator.
}

//> Export declaration.
export async function getOrchestratorIntrospectionSnapshot(): Promise<OrchestratorIntrospectionSnapshot> {
  //> Variable declaration.
  const generatedAt = new Date();
  //> Variable declaration.
  const errors: OrchestratorIntrospectionSnapshot["errors"] = [];

  //> Variable declaration.
  let lease: OrchestratorIntrospectionSnapshot["lease"] = {
    //> Source statement or expression.
    state: "UNKNOWN",
    //> Source statement or expression.
    reason: "Lease snapshot not loaded.",
    //> Source statement or expression.
    ownerId: null,
    //> Source statement or expression.
    ownerAgentKey: null,
    //> Source statement or expression.
    ownerAgentRole: null,
    //> Source statement or expression.
    health: "UNHELD",
    //> Source statement or expression.
    ttlMs: null,
    //> Source statement or expression.
    lastHeartbeatAt: null,
    //> Source statement or expression.
    acquiredAt: null,
    //> Source statement or expression.
    lastAuditCode: null
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  let contextLocks: OrchestratorIntrospectionSnapshot["contextLocks"] = {
    //> Source statement or expression.
    state: "UNKNOWN",
    //> Source statement or expression.
    reason: "Context lock snapshot not loaded.",
    //> Source statement or expression.
    totalActiveLocks: 0,
    //> Source statement or expression.
    blockedLocks: 0,
    //> Source statement or expression.
    warningLocks: 0,
    //> Source statement or expression.
    activeOwners: []
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  let tasks: OrchestratorIntrospectionSnapshot["tasks"] = {
    //> Source statement or expression.
    state: "UNKNOWN",
    //> Source statement or expression.
    reason: "Task pipeline snapshot not loaded.",
    //> Source statement or expression.
    totalOpen: 0,
    //> Source statement or expression.
    queued: 0,
    //> Source statement or expression.
    running: 0,
    //> Source statement or expression.
    manualRequired: 0,
    //> Source statement or expression.
    deadLetter: 0,
    //> Source statement or expression.
    done: 0,
    //> Source statement or expression.
    oldestQueuedAt: null,
    //> Source statement or expression.
    oldestRunningAt: null,
    //> Source statement or expression.
    staleRunningCount: 0
  //> Brace or statement terminator.
  };
  //> Variable declaration.
  let failures: OrchestratorIntrospectionSnapshot["failures"] = {
    //> Source statement or expression.
    state: "UNKNOWN",
    //> Source statement or expression.
    reason: "Failure snapshot not loaded.",
    //> Source statement or expression.
    totalRecent: 0,
    //> Source statement or expression.
    highSeverityRecent: 0,
    //> Source statement or expression.
    latestFailureClass: null
  //> Brace or statement terminator.
  };

  //> Try block start.
  try {
    //> Variable declaration.
    const snapshot = await getOrchestratorLeaseSnapshot();
    //> Variable declaration.
    const state: IntrospectionState =
      //> Source statement or expression.
      snapshot.health === "STALE"
        //> Source statement or expression.
        ? "STALE"
        //> Source statement or expression.
        : snapshot.health === "UNHELD"
        //> Source statement or expression.
        ? "MISSING"
        //> Source statement or expression.
        : "OK";
    //> Variable declaration.
    const reason =
      //> Source statement or expression.
      state === "STALE"
        //> Source statement or expression.
        ? "Lease is stale or expired."
        //> Source statement or expression.
        : state === "MISSING"
        //> Source statement or expression.
        ? "No active lease holder."
        //> Source statement or expression.
        : snapshot.health === "EXPIRING"
        //> Source statement or expression.
        ? "Lease is active but nearing expiry."
        //> Source statement or expression.
        : "Lease is healthy.";

    //> Source statement or expression.
    lease = {
      //> Source statement or expression.
      state,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      ownerId: snapshot.ownerId,
      //> Source statement or expression.
      ownerAgentKey: snapshot.ownerAgentKey,
      //> Source statement or expression.
      ownerAgentRole: snapshot.ownerAgentRole,
      //> Source statement or expression.
      health: snapshot.health,
      //> Source statement or expression.
      ttlMs: snapshot.ttlMs,
      //> Source statement or expression.
      lastHeartbeatAt: isoOrNull(snapshot.lastHeartbeatAt),
      //> Source statement or expression.
      acquiredAt: isoOrNull(snapshot.acquiredAt),
      //> Source statement or expression.
      lastAuditCode: snapshot.lastAudit?.code || null
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Source statement or expression.
    errors.push({ component: "LEASE", message });
    //> Source statement or expression.
    lease = {
      //> Source statement or expression.
      ...lease,
      //> Source statement or expression.
      state: "UNKNOWN",
      //> Source statement or expression.
      reason: "Lease introspection failed."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Try block start.
  try {
    //> Variable declaration.
    const locks = await listActiveProjectAlphaLocks(100);
    //> Variable declaration.
    const blockedLocks = locks.filter((lock) => lock.activeWindow?.guardrailState === "BLOCKED").length;
    //> Variable declaration.
    const warningLocks = locks.filter((lock) => lock.activeWindow?.guardrailState === "WARNING").length;

    //> Variable declaration.
    let state: IntrospectionState = "OK";
    //> Variable declaration.
    let reason = "Active context locks loaded.";
    //> Conditional branch.
    if (locks.length === 0) {
      //> Source statement or expression.
      state = "MISSING";
      //> Source statement or expression.
      reason = "No active Alpha context locks.";
    //> Source statement or expression.
    } else if (blockedLocks > 0) {
      //> Source statement or expression.
      state = "STALE";
      //> Source statement or expression.
      reason = `${blockedLocks} active context lock(s) blocked by guardrail.`;
    //> Source statement or expression.
    } else if (warningLocks > 0) {
      //> Source statement or expression.
      state = "STALE";
      //> Source statement or expression.
      reason = `${warningLocks} active context lock(s) near guardrail threshold.`;
    //> Brace or statement terminator.
    }

    //> Source statement or expression.
    contextLocks = {
      //> Source statement or expression.
      state,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      totalActiveLocks: locks.length,
      //> Source statement or expression.
      blockedLocks,
      //> Source statement or expression.
      warningLocks,
      //> Source statement or expression.
      activeOwners: Array.from(
        //> Source statement or expression.
        new Set(
          //> Source statement or expression.
          locks
            //> Source statement or expression.
            .map((lock) => lock.activeWindow?.ownerAgentKey || "")
            //> Source statement or expression.
            .filter(Boolean)
        //> Delimiter or separator.
        )
      //> Delimiter or separator.
      )
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Source statement or expression.
    errors.push({ component: "CONTEXT", message });
    //> Source statement or expression.
    contextLocks = {
      //> Source statement or expression.
      ...contextLocks,
      //> Source statement or expression.
      state: "UNKNOWN",
      //> Source statement or expression.
      reason: "Context lock introspection failed."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Try block start.
  try {
    //> Variable declaration.
    const [counts, oldestQueued, oldestRunning] = await Promise.all([
      //> Source statement or expression.
      prisma.agentTask.groupBy({
        //> Source statement or expression.
        by: ["status"],
        //> Source statement or expression.
        _count: { _all: true }
      //> Delimiter or separator.
      }),
      //> Source statement or expression.
      prisma.agentTask.findFirst({
        //> Source statement or expression.
        where: { status: "QUEUED" },
        //> Source statement or expression.
        orderBy: { createdAt: "asc" },
        //> Source statement or expression.
        select: { createdAt: true }
      //> Delimiter or separator.
      }),
      //> Source statement or expression.
      prisma.agentTask.findFirst({
        //> Source statement or expression.
        where: { status: "RUNNING" },
        //> Source statement or expression.
        orderBy: { startedAt: "asc" },
        //> Source statement or expression.
        select: { startedAt: true }
      //> Delimiter or separator.
      })
    //> Delimiter or separator.
    ]);

    //> Variable declaration.
    const countByStatus = new Map(counts.map((row) => [row.status, row._count._all]));
    //> Variable declaration.
    const queued = countByStatus.get("QUEUED") || 0;
    //> Variable declaration.
    const running = countByStatus.get("RUNNING") || 0;
    //> Variable declaration.
    const manualRequired = countByStatus.get("MANUAL_REQUIRED") || 0;
    //> Variable declaration.
    const deadLetter = countByStatus.get("DEAD_LETTER") || 0;
    //> Variable declaration.
    const done = countByStatus.get("DONE") || 0;

    //> Variable declaration.
    const staleThreshold = staleRunningThresholdMs();
    //> Variable declaration.
    const staleCutoff = new Date(Date.now() - staleThreshold);
    //> Variable declaration.
    const staleRunningCount = await prisma.agentTask.count({
      //> Source statement or expression.
      where: {
        //> Source statement or expression.
        status: "RUNNING",
        //> Source statement or expression.
        startedAt: { lt: staleCutoff }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    let state: IntrospectionState = "OK";
    //> Variable declaration.
    let reason = "Task pipeline healthy.";
    //> Conditional branch.
    if (staleRunningCount > 0) {
      //> Source statement or expression.
      state = "STALE";
      //> Source statement or expression.
      reason = `${staleRunningCount} RUNNING task(s) exceeded stale threshold.`;
    //> Source statement or expression.
    } else if (queued + running + manualRequired + deadLetter === 0) {
      //> Source statement or expression.
      state = "MISSING";
      //> Source statement or expression.
      reason = "No task activity yet.";
    //> Brace or statement terminator.
    }

    //> Source statement or expression.
    tasks = {
      //> Source statement or expression.
      state,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      totalOpen: queued + running + manualRequired + deadLetter,
      //> Source statement or expression.
      queued,
      //> Source statement or expression.
      running,
      //> Source statement or expression.
      manualRequired,
      //> Source statement or expression.
      deadLetter,
      //> Source statement or expression.
      done,
      //> Source statement or expression.
      oldestQueuedAt: isoOrNull(oldestQueued?.createdAt),
      //> Source statement or expression.
      oldestRunningAt: isoOrNull(oldestRunning?.startedAt),
      //> Source statement or expression.
      staleRunningCount
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Source statement or expression.
    errors.push({ component: "TASKS", message });
    //> Source statement or expression.
    tasks = {
      //> Source statement or expression.
      ...tasks,
      //> Source statement or expression.
      state: "UNKNOWN",
      //> Source statement or expression.
      reason: "Task pipeline introspection failed."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Try block start.
  try {
    //> Variable declaration.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    //> Variable declaration.
    const [recentCount, highSeverityCount, latest] = await Promise.all([
      //> Source statement or expression.
      prisma.alphaFailureEvent.count({
        //> Source statement or expression.
        where: { createdAt: { gte: since } }
      //> Delimiter or separator.
      }),
      //> Source statement or expression.
      prisma.alphaFailureEvent.count({
        //> Source statement or expression.
        where: { createdAt: { gte: since }, severity: "HIGH" }
      //> Delimiter or separator.
      }),
      //> Source statement or expression.
      prisma.alphaFailureEvent.findFirst({
        //> Source statement or expression.
        orderBy: { createdAt: "desc" },
        //> Source statement or expression.
        select: { failureClass: true }
      //> Delimiter or separator.
      })
    //> Delimiter or separator.
    ]);

    //> Variable declaration.
    let state: IntrospectionState = "OK";
    //> Variable declaration.
    let reason = "No recent Alpha failure events.";
    //> Conditional branch.
    if (recentCount === 0) {
      //> Source statement or expression.
      state = "MISSING";
      //> Source statement or expression.
      reason = "No failure events recorded in last 24h.";
    //> Source statement or expression.
    } else if (highSeverityCount > 0) {
      //> Source statement or expression.
      state = "STALE";
      //> Source statement or expression.
      reason = `${highSeverityCount} high-severity fallback event(s) in last 24h.`;
    //> Source statement or expression.
    } else {
      //> Source statement or expression.
      state = "OK";
      //> Source statement or expression.
      reason = `${recentCount} recent fallback event(s), no high-severity incidents.`;
    //> Brace or statement terminator.
    }

    //> Source statement or expression.
    failures = {
      //> Source statement or expression.
      state,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      totalRecent: recentCount,
      //> Source statement or expression.
      highSeverityRecent: highSeverityCount,
      //> Source statement or expression.
      latestFailureClass: latest?.failureClass || null
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Source statement or expression.
    errors.push({ component: "FAILURES", message });
    //> Source statement or expression.
    failures = {
      //> Source statement or expression.
      ...failures,
      //> Source statement or expression.
      state: "UNKNOWN",
      //> Source statement or expression.
      reason: "Failure-event introspection failed."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    generatedAt: generatedAt.toISOString(),
    //> Source statement or expression.
    lease,
    //> Source statement or expression.
    contextLocks,
    //> Source statement or expression.
    tasks,
    //> Source statement or expression.
    failures,
    //> Source statement or expression.
    errors
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
