/**
 * Alpha **context windows**: project-scoped locks, usage guardrails (warning 60%, block 70% without handover),
 * handover/continuation refs, overrides, activation/transfer/close lifecycle, and scope gates for tasks.
 *
 * Large module: DB helpers (`mapWindow`, audits), `deriveGuardrailState`, lease queries for active projects,
 * mutations called from server actions and workers. Constants `WARNING_THRESHOLD` / `BLOCK_THRESHOLD` /
 * `DEFAULT_SCOPE_INCREMENT` drive guardrail behavior; keep in sync with `alpha-failure-policy` copy.
 */
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { validateAlphaHandoverPackage } from "@/lib/handover-package";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  getLatestAlphaContextPackageInvariant,
  //> Source statement or expression.
  recordAlphaContextPackageInvariant
//> Source statement or expression.
} from "@/lib/prompt-package-invariants";
//> Import bindings from a module.
import type { Prisma } from "@prisma/client";

//> Type or interface definition.
type AlphaContextDb = Prisma.TransactionClient | typeof prisma;

//> Variable declaration.
const WARNING_THRESHOLD = 60;
//> Variable declaration.
const BLOCK_THRESHOLD = 70;
//> Variable declaration.
const DEFAULT_SCOPE_INCREMENT = 8;

//> Type or interface definition.
type AgentResolution =
  //> Source statement or expression.
  | { ok: true; agentKey: string; displayName: string | null }
  //> Source statement or expression.
  | { ok: false; reason: string };

//> Type or interface definition.
type LockedProjectRow = Prisma.ProjectAlphaLockGetPayload<{
  //> Source statement or expression.
  include: {
    //> Source statement or expression.
    activeWindow: {
      //> Source statement or expression.
      include: {
        //> Source statement or expression.
        ownerAgent: { select: { displayName: true } };
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  };
//> Delimiter or separator.
}>;

//> Export declaration.
export type AlphaContextGuardrailState =
  //> Source statement or expression.
  | "NO_ACTIVE_LOCK"
  //> Source statement or expression.
  | "OK"
  //> Source statement or expression.
  | "WARNING"
  //> Source statement or expression.
  | "BLOCKED"
  //> Source statement or expression.
  | "OVERRIDE_ACTIVE"
  //> Source statement or expression.
  | "PACKAGE_READY";

//> Export declaration.
export type AlphaContextWindowSummary = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  projectKey: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  ownerAgentKey: string;
  //> Source statement or expression.
  ownerAgentDisplayName: string | null;
  //> Source statement or expression.
  status: "OPEN" | "ACTIVE" | "TRANSFERRED" | "CLOSED";
  //> Source statement or expression.
  activationHandoverRef: string | null;
  //> Source statement or expression.
  transferHandoverRef: string | null;
  //> Source statement or expression.
  closeHandoverRef: string | null;
  //> Source statement or expression.
  continuityNote: string | null;
  //> Source statement or expression.
  contextUsagePercent: number;
  //> Source statement or expression.
  contextWarningAt: string | null;
  //> Source statement or expression.
  contextBlockedAt: string | null;
  //> Source statement or expression.
  handoverPackageRef: string | null;
  //> Source statement or expression.
  continuationPromptRef: string | null;
  //> Source statement or expression.
  handoverPackageReadyAt: string | null;
  //> Source statement or expression.
  guardrailOverrideUntil: string | null;
  //> Source statement or expression.
  guardrailOverrideReason: string | null;
  //> Source statement or expression.
  guardrailState: AlphaContextGuardrailState;
  //> Source statement or expression.
  predecessorId: string | null;
  //> Source statement or expression.
  activatedAt: string | null;
  //> Source statement or expression.
  transferredAt: string | null;
  //> Source statement or expression.
  closedAt: string | null;
  //> Source statement or expression.
  createdAt: string;
  //> Source statement or expression.
  updatedAt: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type ProjectAlphaLockSnapshot = {
  //> Source statement or expression.
  projectKey: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  continuityRef: string | null;
  //> Source statement or expression.
  activatedAt: string | null;
  //> Source statement or expression.
  updatedAt: string | null;
  //> Source statement or expression.
  activeWindow: AlphaContextWindowSummary | null;
//> Brace or statement terminator.
};

//> Export declaration.
export type AlphaContextMutationResult = {
  //> Source statement or expression.
  ok: boolean;
  //> Source statement or expression.
  code:
    //> Source statement or expression.
    | "CONTEXT_ACTIVATED"
    //> Source statement or expression.
    | "CONTEXT_TRANSFERRED"
    //> Source statement or expression.
    | "CONTEXT_CLOSED"
    //> Source statement or expression.
    | "HANDOVER_PACKAGE_RECORDED"
    //> Source statement or expression.
    | "GUARDRAIL_OVERRIDE_SET"
    //> Source statement or expression.
    | "ACTIVATION_DENIED"
    //> Source statement or expression.
    | "TRANSFER_DENIED"
    //> Source statement or expression.
    | "CLOSE_DENIED"
    //> Source statement or expression.
    | "HANDOVER_PACKAGE_DENIED"
    //> Source statement or expression.
    | "GUARDRAIL_OVERRIDE_DENIED";
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  projectKey: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  activeWindowId: string | null;
//> Brace or statement terminator.
};

//> Export declaration.
export type AlphaContextScopeGateResult = {
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  status: AlphaContextGuardrailState;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  projectKey: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  activeWindowId: string | null;
  //> Source statement or expression.
  usagePercent: number;
//> Brace or statement terminator.
};

//> Export declaration.
export type AlphaContextAuditSummary = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  actorRole: string;
  //> Source statement or expression.
  action: string;
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  windowId: string | null;
  //> Source statement or expression.
  conflictingWindowId: string | null;
  //> Source statement or expression.
  createdAt: string;
//> Brace or statement terminator.
};

//> Function declaration.
function normalizeText(input: string | null | undefined) {
  //> Return a value.
  return String(input || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function clampInt(input: unknown, fallback: number, min: number, max: number) {
  //> Variable declaration.
  const parsed = Number(input);
  //> Conditional branch.
  if (!Number.isFinite(parsed)) return fallback;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(parsed), min), max);
//> Brace or statement terminator.
}

//> Export declaration.
export function normalizeProjectIdentity(projectName: string) {
  //> Variable declaration.
  const display = normalizeText(projectName);
  //> Conditional branch.
  if (!display) {
    //> Throw error.
    throw new Error("Project is required to manage Alpha context lock.");
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    projectKey: display.toLowerCase(),
    //> Source statement or expression.
    projectName: display
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function isoOrNull(value: Date | null | undefined) {
  //> Return a value.
  return value instanceof Date ? value.toISOString() : null;
//> Brace or statement terminator.
}

//> Function declaration.
function hasHandoverPackage(window: {
  //> Source statement or expression.
  handoverPackageRef: string | null;
  //> Source statement or expression.
  continuationPromptRef: string | null;
  //> Source statement or expression.
  handoverPackageReadyAt: Date | null;
//> Source statement or expression.
}) {
  //> Return a value.
  return Boolean(
    //> Source statement or expression.
    window.handoverPackageReadyAt &&
      //> Source statement or expression.
      normalizeText(window.handoverPackageRef) &&
      //> Source statement or expression.
      normalizeText(window.continuationPromptRef)
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Function declaration.
function hasActiveOverride(window: { guardrailOverrideUntil: Date | null }) {
  //> Return a value.
  return Boolean(
    //> Source statement or expression.
    window.guardrailOverrideUntil && window.guardrailOverrideUntil.getTime() > Date.now()
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Export declaration.
export function deriveGuardrailState(window: {
  //> Source statement or expression.
  contextUsagePercent: number;
  //> Source statement or expression.
  handoverPackageRef: string | null;
  //> Source statement or expression.
  continuationPromptRef: string | null;
  //> Source statement or expression.
  handoverPackageReadyAt: Date | null;
  //> Source statement or expression.
  guardrailOverrideUntil: Date | null;
//> Source statement or expression.
}): AlphaContextGuardrailState {
  //> Variable declaration.
  const usage = clampInt(window.contextUsagePercent, 0, 0, 100);
  //> Variable declaration.
  const packageReady = hasHandoverPackage(window);
  //> Variable declaration.
  const overrideActive = hasActiveOverride(window);

  //> Conditional branch.
  if (usage >= BLOCK_THRESHOLD && !packageReady) {
    //> Conditional branch.
    if (overrideActive) return "OVERRIDE_ACTIVE";
    //> Return a value.
    return "BLOCKED";
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (usage >= WARNING_THRESHOLD) {
    //> Return a value.
    return packageReady ? "PACKAGE_READY" : "WARNING";
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (packageReady) return "PACKAGE_READY";
  //> Return a value.
  return "OK";
//> Brace or statement terminator.
}

//> Function declaration.
function mapWindow(
  //> Source statement or expression.
  row: LockedProjectRow["activeWindow"] | null
//> Source statement or expression.
): AlphaContextWindowSummary | null {
  //> Conditional branch.
  if (!row) return null;
  //> Return a value.
  return {
    //> Source statement or expression.
    id: row.id,
    //> Source statement or expression.
    projectKey: row.projectKey,
    //> Source statement or expression.
    projectName: row.projectName,
    //> Source statement or expression.
    ownerAgentKey: row.ownerAgentKey,
    //> Source statement or expression.
    ownerAgentDisplayName: row.ownerAgent.displayName,
    //> Source statement or expression.
    status: row.status,
    //> Source statement or expression.
    activationHandoverRef: row.activationHandoverRef,
    //> Source statement or expression.
    transferHandoverRef: row.transferHandoverRef,
    //> Source statement or expression.
    closeHandoverRef: row.closeHandoverRef,
    //> Source statement or expression.
    continuityNote: row.continuityNote,
    //> Source statement or expression.
    contextUsagePercent: clampInt(row.contextUsagePercent, 0, 0, 100),
    //> Source statement or expression.
    contextWarningAt: isoOrNull(row.contextWarningAt),
    //> Source statement or expression.
    contextBlockedAt: isoOrNull(row.contextBlockedAt),
    //> Source statement or expression.
    handoverPackageRef: row.handoverPackageRef,
    //> Source statement or expression.
    continuationPromptRef: row.continuationPromptRef,
    //> Source statement or expression.
    handoverPackageReadyAt: isoOrNull(row.handoverPackageReadyAt),
    //> Source statement or expression.
    guardrailOverrideUntil: isoOrNull(row.guardrailOverrideUntil),
    //> Source statement or expression.
    guardrailOverrideReason: row.guardrailOverrideReason,
    //> Source statement or expression.
    guardrailState: deriveGuardrailState(row),
    //> Source statement or expression.
    predecessorId: row.predecessorId,
    //> Source statement or expression.
    activatedAt: isoOrNull(row.activatedAt),
    //> Source statement or expression.
    transferredAt: isoOrNull(row.transferredAt),
    //> Source statement or expression.
    closedAt: isoOrNull(row.closedAt),
    //> Source statement or expression.
    createdAt: row.createdAt.toISOString(),
    //> Source statement or expression.
    updatedAt: row.updatedAt.toISOString()
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function recordAudit(
  //> Source statement or expression.
  db: AlphaContextDb,
  //> Source statement or expression.
  params: {
    //> Source statement or expression.
    projectKey: string;
    //> Source statement or expression.
    projectName: string;
    //> Source statement or expression.
    actorRole: string;
    //> Source statement or expression.
    action: string;
    //> Source statement or expression.
    allowed: boolean;
    //> Source statement or expression.
    reason: string;
    //> Source statement or expression.
    windowId?: string | null;
    //> Source statement or expression.
    conflictingWindowId?: string | null;
    //> Source statement or expression.
    metadata?: Prisma.InputJsonValue;
  //> Brace or statement terminator.
  }
//> Source statement or expression.
) {
  //> Await async value.
  await db.alphaContextAuditEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      projectKey: params.projectKey,
      //> Source statement or expression.
      projectName: params.projectName,
      //> Source statement or expression.
      actorRole: params.actorRole,
      //> Source statement or expression.
      action: params.action,
      //> Source statement or expression.
      allowed: params.allowed,
      //> Source statement or expression.
      reason: params.reason,
      //> Source statement or expression.
      windowId: params.windowId ?? null,
      //> Source statement or expression.
      conflictingWindowId: params.conflictingWindowId ?? null,
      //> Source statement or expression.
      metadata: params.metadata
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function ensureProjectLockRow(params: {
  //> Source statement or expression.
  db: AlphaContextDb;
  //> Source statement or expression.
  projectKey: string;
  //> Source statement or expression.
  projectName: string;
//> Source statement or expression.
}) {
  //> Await async value.
  await params.db.projectAlphaLock.upsert({
    //> Source statement or expression.
    where: { projectKey: params.projectKey },
    //> Source statement or expression.
    create: {
      //> Source statement or expression.
      projectKey: params.projectKey,
      //> Source statement or expression.
      projectName: params.projectName
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    update: {
      //> Source statement or expression.
      projectName: params.projectName
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function lockProjectRow(db: AlphaContextDb, projectKey: string): Promise<LockedProjectRow | null> {
  //> Await async value.
  await db.$queryRaw`
    //> Source statement or expression.
    SELECT "projectKey"
    //> Source statement or expression.
    FROM "ProjectAlphaLock"
    //> Source statement or expression.
    WHERE "projectKey" = ${projectKey}
    //> Source statement or expression.
    FOR UPDATE
  //> String literal line.
  `;

  //> Return a value.
  return db.projectAlphaLock.findUnique({
    //> Source statement or expression.
    where: { projectKey },
    //> Source statement or expression.
    include: {
      //> Source statement or expression.
      activeWindow: {
        //> Source statement or expression.
        include: {
          //> Source statement or expression.
          ownerAgent: { select: { displayName: true } }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveAlphaAgent(
  //> Source statement or expression.
  db: AlphaContextDb,
  //> Source statement or expression.
  requestedKey: string,
  //> Source statement or expression.
  mode: "start" | "transfer"
//> Source statement or expression.
): Promise<AgentResolution> {
  //> Variable declaration.
  const raw = normalizeText(requestedKey);
  //> Conditional branch.
  if (!raw) {
    //> Return a value.
    return { ok: false, reason: "Alpha agent key is required." };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const agent = await db.agent.findFirst({
    //> Source statement or expression.
    where: { key: { equals: raw, mode: "insensitive" } },
    //> Source statement or expression.
    select: {
      //> Source statement or expression.
      key: true,
      //> Source statement or expression.
      displayName: true,
      //> Source statement or expression.
      enabled: true,
      //> Source statement or expression.
      controlRole: true
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!agent) {
    //> Return a value.
    return { ok: false, reason: `Alpha context ${mode} denied: agent @${raw} is not registered.` };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!agent.enabled) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      reason: `Alpha context ${mode} denied: agent @${agent.key} is disabled.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (agent.controlRole !== "ALPHA") {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      reason: `Alpha context ${mode} denied: agent @${agent.key} role is ${agent.controlRole}.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { ok: true, agentKey: agent.key, displayName: agent.displayName };
//> Brace or statement terminator.
}

//> Function declaration.
function denormalizeProject(lock: LockedProjectRow | null, fallback: { projectName: string }) {
  //> Return a value.
  return lock?.projectName || fallback.projectName;
//> Brace or statement terminator.
}

//> Export declaration.
export async function getProjectAlphaLockSnapshot(
  //> Source statement or expression.
  projectName: string
//> Source statement or expression.
): Promise<ProjectAlphaLockSnapshot> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(projectName);
  //> Variable declaration.
  const lock = await prisma.projectAlphaLock.findUnique({
    //> Source statement or expression.
    where: { projectKey: project.projectKey },
    //> Source statement or expression.
    include: {
      //> Source statement or expression.
      activeWindow: {
        //> Source statement or expression.
        include: {
          //> Source statement or expression.
          ownerAgent: { select: { displayName: true } }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Return a value.
  return {
    //> Source statement or expression.
    projectKey: project.projectKey,
    //> Source statement or expression.
    projectName: lock?.projectName || project.projectName,
    //> Source statement or expression.
    continuityRef: lock?.continuityRef || null,
    //> Source statement or expression.
    activatedAt: isoOrNull(lock?.activatedAt),
    //> Source statement or expression.
    updatedAt: isoOrNull(lock?.updatedAt),
    //> Source statement or expression.
    activeWindow: mapWindow(lock?.activeWindow ?? null)
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export async function listActiveProjectAlphaLocks(limit = 30) {
  //> Variable declaration.
  const rows = await prisma.projectAlphaLock.findMany({
    //> Source statement or expression.
    where: { activeWindowId: { not: null } },
    //> Source statement or expression.
    include: {
      //> Source statement or expression.
      activeWindow: {
        //> Source statement or expression.
        include: {
          //> Source statement or expression.
          ownerAgent: { select: { displayName: true } }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    orderBy: [{ updatedAt: "desc" }],
    //> Source statement or expression.
    take: Math.min(Math.max(limit, 1), 200)
  //> Brace or statement terminator.
  });

  //> Return a value.
  return rows.map((row) => ({
    //> Source statement or expression.
    projectKey: row.projectKey,
    //> Source statement or expression.
    projectName: row.projectName,
    //> Source statement or expression.
    continuityRef: row.continuityRef,
    //> Source statement or expression.
    activatedAt: isoOrNull(row.activatedAt),
    //> Source statement or expression.
    updatedAt: row.updatedAt.toISOString(),
    //> Source statement or expression.
    activeWindow: mapWindow(row.activeWindow)
  //> Delimiter or separator.
  }));
//> Brace or statement terminator.
}

//> Export declaration.
export async function listProjectAlphaContextAuditEvents(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  limit?: number;
//> Source statement or expression.
}): Promise<AlphaContextAuditSummary[]> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(params.projectName);
  //> Variable declaration.
  const rows = await prisma.alphaContextAuditEvent.findMany({
    //> Source statement or expression.
    where: { projectKey: project.projectKey },
    //> Source statement or expression.
    orderBy: { createdAt: "desc" },
    //> Source statement or expression.
    take: Math.min(Math.max(params.limit ?? 20, 1), 100)
  //> Brace or statement terminator.
  });

  //> Return a value.
  return rows.map((row) => ({
    //> Source statement or expression.
    id: row.id,
    //> Source statement or expression.
    actorRole: row.actorRole,
    //> Source statement or expression.
    action: row.action,
    //> Source statement or expression.
    allowed: row.allowed,
    //> Source statement or expression.
    reason: row.reason,
    //> Source statement or expression.
    windowId: row.windowId,
    //> Source statement or expression.
    conflictingWindowId: row.conflictingWindowId,
    //> Source statement or expression.
    createdAt: row.createdAt.toISOString()
  //> Delimiter or separator.
  }));
//> Brace or statement terminator.
}

//> Export declaration.
export async function consumeContextBudgetForScopeExpansion(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  actorUserId?: string | null;
  //> Source statement or expression.
  sourceAction: string;
  //> Source statement or expression.
  incrementPercent?: number;
  //> Source statement or expression.
  metadata?: Prisma.InputJsonValue;
//> Source statement or expression.
}): Promise<AlphaContextScopeGateResult> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(params.projectName);
  //> Variable declaration.
  const incrementPercent = clampInt(
    //> Source statement or expression.
    params.incrementPercent,
    //> Source statement or expression.
    DEFAULT_SCOPE_INCREMENT,
    //> Source statement or expression.
    1,
    //> Source statement or expression.
    25
  //> Delimiter or separator.
  );

  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureProjectLockRow({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const lock = await lockProjectRow(tx, project.projectKey);
    //> Conditional branch.
    if (!lock?.activeWindowId || !lock.activeWindow) {
      //> Return a value.
      return {
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        status: "NO_ACTIVE_LOCK",
        //> Source statement or expression.
        reason: `No active Alpha context lock for project ${denormalizeProject(lock, project)}.`,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: null,
        //> Source statement or expression.
        usagePercent: 0
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const now = new Date();
    //> Variable declaration.
    const nextUsage = Math.min(
      //> Source statement or expression.
      100,
      //> Source statement or expression.
      clampInt(lock.activeWindow.contextUsagePercent, 0, 0, 100) + incrementPercent
    //> Delimiter or separator.
    );
    //> Variable declaration.
    const packageReady = hasHandoverPackage(lock.activeWindow);
    //> Variable declaration.
    const overrideActive = hasActiveOverride(lock.activeWindow);
    //> Variable declaration.
    const blocked = nextUsage >= BLOCK_THRESHOLD && !packageReady && !overrideActive;

    //> Await async value.
    await tx.alphaContextWindow.update({
      //> Source statement or expression.
      where: { id: lock.activeWindowId },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        contextUsagePercent: nextUsage,
        //> Source statement or expression.
        contextUsageUpdatedAt: now,
        //> Source statement or expression.
        contextWarningAt:
          //> Source statement or expression.
          nextUsage >= WARNING_THRESHOLD
            //> Source statement or expression.
            ? lock.activeWindow.contextWarningAt || now
            //> Source statement or expression.
            : lock.activeWindow.contextWarningAt,
        //> Source statement or expression.
        contextBlockedAt: blocked ? lock.activeWindow.contextBlockedAt || now : lock.activeWindow.contextBlockedAt
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const updatedWindow = {
      //> Source statement or expression.
      ...lock.activeWindow,
      //> Source statement or expression.
      contextUsagePercent: nextUsage,
      //> Source statement or expression.
      contextWarningAt:
        //> Source statement or expression.
        nextUsage >= WARNING_THRESHOLD
          //> Source statement or expression.
          ? lock.activeWindow.contextWarningAt || now
          //> Source statement or expression.
          : lock.activeWindow.contextWarningAt,
      //> Source statement or expression.
      contextBlockedAt: blocked ? lock.activeWindow.contextBlockedAt || now : lock.activeWindow.contextBlockedAt
    //> Brace or statement terminator.
    };
    //> Variable declaration.
    const state = deriveGuardrailState(updatedWindow);

    //> Conditional branch.
    if (blocked) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Context guardrail blocked scope expansion for ${project.projectName} at ${nextUsage}% usage. ` +
        //> String literal line.
        "Record handover package + continuation prompt before enqueuing new scope.";
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "CONTEXT_GUARDRAIL_BLOCK",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          sourceAction: params.sourceAction,
          //> Source statement or expression.
          usagePercent: nextUsage,
          //> Source statement or expression.
          actorUserId: params.actorUserId || null,
          //> Source statement or expression.
          detail: params.metadata || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        status: state,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId,
        //> Source statement or expression.
        usagePercent: nextUsage
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (state === "OVERRIDE_ACTIVE") {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Context guardrail override active for ${project.projectName}. Scope expansion allowed at ${nextUsage}% usage.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "ADMIN_OVERRIDE",
        //> Source statement or expression.
        action: "CONTEXT_GUARDRAIL_OVERRIDE_ALLOW",
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          sourceAction: params.sourceAction,
          //> Source statement or expression.
          usagePercent: nextUsage,
          //> Source statement or expression.
          overrideUntil: isoOrNull(lock.activeWindow.guardrailOverrideUntil),
          //> Source statement or expression.
          actorUserId: params.actorUserId || null,
          //> Source statement or expression.
          detail: params.metadata || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        status: state,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId,
        //> Source statement or expression.
        usagePercent: nextUsage
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (state === "WARNING") {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Context usage warning for ${project.projectName}: ${nextUsage}% (threshold ${BLOCK_THRESHOLD}%).`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "CONTEXT_GUARDRAIL_WARNING",
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          sourceAction: params.sourceAction,
          //> Source statement or expression.
          usagePercent: nextUsage,
          //> Source statement or expression.
          actorUserId: params.actorUserId || null,
          //> Source statement or expression.
          detail: params.metadata || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        status: state,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId,
        //> Source statement or expression.
        usagePercent: nextUsage
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (state === "PACKAGE_READY") {
      //> Return a value.
      return {
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        status: state,
        //> Source statement or expression.
        reason: `Handover package is complete for ${project.projectName}; scope expansion allowed.`,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId,
        //> Source statement or expression.
        usagePercent: nextUsage
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Return a value.
    return {
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      status: state,
      //> Source statement or expression.
      reason: `Context usage ${nextUsage}% for ${project.projectName}.`,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      activeWindowId: lock.activeWindowId,
      //> Source statement or expression.
      usagePercent: nextUsage
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function recordActiveContextHandoverPackage(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  handoverPackageRef: string;
  //> Source statement or expression.
  continuationPromptRef: string;
  //> Source statement or expression.
  actorUserId?: string | null;
  //> Source statement or expression.
  note?: string | null;
//> Source statement or expression.
}): Promise<AlphaContextMutationResult> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(params.projectName);
  //> Variable declaration.
  const handoverPackageRef = normalizeText(params.handoverPackageRef);
  //> Variable declaration.
  const continuationPromptRef = normalizeText(params.continuationPromptRef);
  //> Variable declaration.
  const note = normalizeText(params.note);

  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureProjectLockRow({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const lock = await lockProjectRow(tx, project.projectKey);
    //> Conditional branch.
    if (!lock?.activeWindowId || !lock.activeWindow) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Handover package recording denied for ${project.projectName}: no active context window.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "CONTEXT_HANDOVER_PACKAGE",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "HANDOVER_PACKAGE_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: null
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (!handoverPackageRef || !continuationPromptRef) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        "Handover package reference and continuation prompt reference are both required.";
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "CONTEXT_HANDOVER_PACKAGE",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "HANDOVER_PACKAGE_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const validation = await validateAlphaHandoverPackage({
      //> Source statement or expression.
      handoverPackageRef,
      //> Source statement or expression.
      continuationPromptRef,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      activeWindowId: lock.activeWindowId,
      //> Source statement or expression.
      ownerAgentKey: lock.activeWindow.ownerAgentKey
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (!validation.valid) {
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "CONTEXT_HANDOVER_PACKAGE",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: validation.reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          handoverPackageRef,
          //> Source statement or expression.
          continuationPromptRef,
          //> Source statement or expression.
          missingSections: validation.missingSections,
          //> Source statement or expression.
          missingMetadataFields: validation.missingMetadataFields,
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "HANDOVER_PACKAGE_DENIED",
        //> Source statement or expression.
        reason: validation.reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const now = new Date();
    //> Await async value.
    await tx.alphaContextWindow.update({
      //> Source statement or expression.
      where: { id: lock.activeWindowId },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        handoverPackageRef,
        //> Source statement or expression.
        continuationPromptRef,
        //> Source statement or expression.
        handoverPackageReadyAt: now,
        //> Source statement or expression.
        continuityNote: note || lock.activeWindow.continuityNote || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await tx.projectAlphaLock.update({
      //> Source statement or expression.
      where: { projectKey: project.projectKey },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        continuityRef: handoverPackageRef
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await recordAlphaContextPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      input: {
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        snapshotKind: "HANDOVER_PACKAGE",
        //> Source statement or expression.
        sourceRef: handoverPackageRef,
        //> Source statement or expression.
        handoverPackageRef,
        //> Source statement or expression.
        continuationPromptRef,
        //> Source statement or expression.
        continuityNote: note || lock.activeWindow.continuityNote || null,
        //> Source statement or expression.
        payloadSnapshot: {
          //> Source statement or expression.
          validation: {
            //> Source statement or expression.
            valid: validation.valid,
            //> Source statement or expression.
            missingSections: validation.missingSections,
            //> Source statement or expression.
            missingMetadataFields: validation.missingMetadataFields
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        createdById: params.actorUserId ?? null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const recentFailures = await tx.alphaFailureEvent.findMany({
      //> Source statement or expression.
      where: { projectKey: project.projectKey },
      //> Source statement or expression.
      orderBy: { createdAt: "desc" },
      //> Source statement or expression.
      take: 5,
      //> Source statement or expression.
      select: {
        //> Source statement or expression.
        failureClass: true,
        //> Source statement or expression.
        fallbackAction: true,
        //> Source statement or expression.
        severity: true,
        //> Source statement or expression.
        createdAt: true
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const reason =
      //> String literal line.
      `Handover package recorded for project ${project.projectName}; guardrail gate can continue.`;
    //> Await async value.
    await recordAudit(tx, {
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "CONTEXT_HANDOVER_PACKAGE",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      windowId: lock.activeWindowId,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        handoverPackageRef,
        //> Source statement or expression.
        continuationPromptRef,
        //> Source statement or expression.
        recentFailureContext: recentFailures.map((event) => ({
          //> Source statement or expression.
          failureClass: event.failureClass,
          //> Source statement or expression.
          fallbackAction: event.fallbackAction,
          //> Source statement or expression.
          severity: event.severity,
          //> Source statement or expression.
          createdAt: event.createdAt.toISOString()
        //> Delimiter or separator.
        })),
        //> Source statement or expression.
        actorUserId: params.actorUserId || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Return a value.
    return {
      //> Source statement or expression.
      ok: true,
      //> Source statement or expression.
      code: "HANDOVER_PACKAGE_RECORDED",
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      activeWindowId: lock.activeWindowId
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function setContextGuardrailOverride(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  overrideReason: string;
  //> Source statement or expression.
  actorUserId?: string | null;
  //> Source statement or expression.
  durationMinutes?: number;
//> Source statement or expression.
}): Promise<AlphaContextMutationResult> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(params.projectName);
  //> Variable declaration.
  const overrideReason = normalizeText(params.overrideReason);
  //> Variable declaration.
  const durationMinutes = clampInt(params.durationMinutes, 30, 5, 240);

  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureProjectLockRow({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const lock = await lockProjectRow(tx, project.projectKey);
    //> Conditional branch.
    if (!lock?.activeWindowId || !lock.activeWindow) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Guardrail override denied for ${project.projectName}: no active context window.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "ADMIN_OVERRIDE",
        //> Source statement or expression.
        action: "CONTEXT_GUARDRAIL_OVERRIDE_SET",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "GUARDRAIL_OVERRIDE_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: null
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (!overrideReason) {
      //> Variable declaration.
      const reason = "Guardrail override denied: override reason is required.";
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "ADMIN_OVERRIDE",
        //> Source statement or expression.
        action: "CONTEXT_GUARDRAIL_OVERRIDE_SET",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "GUARDRAIL_OVERRIDE_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const now = new Date();
    //> Variable declaration.
    const overrideUntil = new Date(now.getTime() + durationMinutes * 60_000);
    //> Await async value.
    await tx.alphaContextWindow.update({
      //> Source statement or expression.
      where: { id: lock.activeWindowId },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        guardrailOverrideUntil: overrideUntil,
        //> Source statement or expression.
        guardrailOverrideReason: overrideReason
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const reason =
      //> String literal line.
      `Guardrail override set for ${project.projectName} until ${overrideUntil.toISOString()}.`;
    //> Await async value.
    await recordAudit(tx, {
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      actorRole: "ADMIN_OVERRIDE",
      //> Source statement or expression.
      action: "CONTEXT_GUARDRAIL_OVERRIDE_SET",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      windowId: lock.activeWindowId,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        overrideReason,
        //> Source statement or expression.
        durationMinutes,
        //> Source statement or expression.
        actorUserId: params.actorUserId || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Return a value.
    return {
      //> Source statement or expression.
      ok: true,
      //> Source statement or expression.
      code: "GUARDRAIL_OVERRIDE_SET",
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      activeWindowId: lock.activeWindowId
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function openAndActivateAlphaContextWindow(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  ownerAgentKey: string;
  //> Source statement or expression.
  actorUserId?: string | null;
  //> Source statement or expression.
  activationHandoverRef?: string | null;
  //> Source statement or expression.
  continuityNote?: string | null;
//> Source statement or expression.
}): Promise<AlphaContextMutationResult> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(params.projectName);
  //> Variable declaration.
  const activationHandoverRef = normalizeText(params.activationHandoverRef);
  //> Variable declaration.
  const continuityNote = normalizeText(params.continuityNote);

  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureProjectLockRow({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const lock = await lockProjectRow(tx, project.projectKey);
    //> Variable declaration.
    const alphaAgent = await resolveAlphaAgent(tx, params.ownerAgentKey, "start");
    //> Conditional branch.
    if (!alphaAgent.ok) {
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "ACTIVATE_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: alphaAgent.reason,
        //> Source statement or expression.
        conflictingWindowId: lock?.activeWindowId || null,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          requestedOwnerAgentKey: normalizeText(params.ownerAgentKey),
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "ACTIVATION_DENIED",
        //> Source statement or expression.
        reason: alphaAgent.reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock?.activeWindowId || null
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (lock?.activeWindowId) {
      //> Variable declaration.
      const activeOwner = lock.activeWindow?.ownerAgentKey || lock.activeOwnerAgentKey || "unknown";
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Alpha context activation denied for project ${project.projectName}: ` +
        //> String literal line.
        `active window already held by @${activeOwner}.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "ACTIVATE_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        conflictingWindowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          requestedOwnerAgentKey: alphaAgent.agentKey,
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "ACTIVATION_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const now = new Date();
    //> Variable declaration.
    const opened = await tx.alphaContextWindow.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        ownerAgentKey: alphaAgent.agentKey,
        //> Source statement or expression.
        status: "OPEN",
        //> Source statement or expression.
        activationHandoverRef: activationHandoverRef || null,
        //> Source statement or expression.
        continuityNote: continuityNote || null,
        //> Source statement or expression.
        createdById: params.actorUserId ?? null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await recordAudit(tx, {
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "OPEN_CONTEXT_WINDOW",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: "Alpha context window opened.",
      //> Source statement or expression.
      windowId: opened.id,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        ownerAgentKey: alphaAgent.agentKey,
        //> Source statement or expression.
        actorUserId: params.actorUserId || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const activeWindow = await tx.alphaContextWindow.update({
      //> Source statement or expression.
      where: { id: opened.id },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        status: "ACTIVE",
        //> Source statement or expression.
        activatedAt: now
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await recordAlphaContextPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      input: {
        //> Source statement or expression.
        windowId: activeWindow.id,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        snapshotKind: "ACTIVATED",
        //> Source statement or expression.
        sourceRef: activationHandoverRef || null,
        //> Source statement or expression.
        handoverRef: activationHandoverRef || null,
        //> Source statement or expression.
        continuityNote: continuityNote || null,
        //> Source statement or expression.
        payloadSnapshot: {
          //> Source statement or expression.
          ownerAgentKey: alphaAgent.agentKey
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        createdById: params.actorUserId ?? null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await tx.projectAlphaLock.update({
      //> Source statement or expression.
      where: { projectKey: project.projectKey },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        activeWindowId: activeWindow.id,
        //> Source statement or expression.
        activeOwnerAgentKey: alphaAgent.agentKey,
        //> Source statement or expression.
        continuityRef: activationHandoverRef || null,
        //> Source statement or expression.
        activatedAt: now
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const reason = `Alpha context lock activated for project ${project.projectName} by @${alphaAgent.agentKey}.`;
    //> Await async value.
    await recordAudit(tx, {
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "ACTIVATE_CONTEXT_WINDOW",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      windowId: activeWindow.id,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        ownerAgentKey: alphaAgent.agentKey,
        //> Source statement or expression.
        activationHandoverRef: activationHandoverRef || null,
        //> Source statement or expression.
        actorUserId: params.actorUserId || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Return a value.
    return {
      //> Source statement or expression.
      ok: true,
      //> Source statement or expression.
      code: "CONTEXT_ACTIVATED",
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName,
      //> Source statement or expression.
      activeWindowId: activeWindow.id
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function transferActiveAlphaContextWindow(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  toAgentKey: string;
  //> Source statement or expression.
  actorUserId?: string | null;
  //> Source statement or expression.
  handoverRef: string;
  //> Source statement or expression.
  continuityNote?: string | null;
//> Source statement or expression.
}): Promise<AlphaContextMutationResult> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(params.projectName);
  //> Variable declaration.
  const handoverRef = normalizeText(params.handoverRef);
  //> Variable declaration.
  const continuityNote = normalizeText(params.continuityNote);

  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureProjectLockRow({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const lock = await lockProjectRow(tx, project.projectKey);
    //> Conditional branch.
    if (!lock?.activeWindowId || !lock.activeWindow) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Alpha context transfer denied for project ${project.projectName}: no active window exists.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "TRANSFER_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          requestedToAgentKey: normalizeText(params.toAgentKey),
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "TRANSFER_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: null
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (!handoverRef) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Alpha context transfer denied for project ${project.projectName}: handover package reference is required.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "TRANSFER_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          requestedToAgentKey: normalizeText(params.toAgentKey),
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "TRANSFER_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const target = await resolveAlphaAgent(tx, params.toAgentKey, "transfer");
    //> Conditional branch.
    if (!target.ok) {
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "TRANSFER_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: target.reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          requestedToAgentKey: normalizeText(params.toAgentKey),
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "TRANSFER_DENIED",
        //> Source statement or expression.
        reason: target.reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (target.agentKey === lock.activeWindow.ownerAgentKey) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Alpha context transfer denied for project ${project.projectName}: @${target.agentKey} already owns the active window.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "TRANSFER_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          requestedToAgentKey: target.agentKey,
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "TRANSFER_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const now = new Date();
    //> Variable declaration.
    const successorOpen = await tx.alphaContextWindow.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        ownerAgentKey: target.agentKey,
        //> Source statement or expression.
        status: "OPEN",
        //> Source statement or expression.
        predecessorId: lock.activeWindowId,
        //> Source statement or expression.
        activationHandoverRef: handoverRef,
        //> Source statement or expression.
        continuityNote: continuityNote || null,
        //> Source statement or expression.
        createdById: params.actorUserId ?? null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await recordAudit(tx, {
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "OPEN_CONTEXT_WINDOW",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: "Successor Alpha context window opened for transfer.",
      //> Source statement or expression.
      windowId: successorOpen.id,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        transferFromWindowId: lock.activeWindowId,
        //> Source statement or expression.
        ownerAgentKey: target.agentKey,
        //> Source statement or expression.
        actorUserId: params.actorUserId || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const successorActive = await tx.alphaContextWindow.update({
      //> Source statement or expression.
      where: { id: successorOpen.id },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        status: "ACTIVE",
        //> Source statement or expression.
        activatedAt: now
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await tx.alphaContextWindow.update({
      //> Source statement or expression.
      where: { id: lock.activeWindowId },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        status: "TRANSFERRED",
        //> Source statement or expression.
        transferredAt: now,
        //> Source statement or expression.
        transferHandoverRef: handoverRef,
        //> Source statement or expression.
        continuityNote: continuityNote || lock.activeWindow.continuityNote || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const priorSnapshot = await getLatestAlphaContextPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      windowId: lock.activeWindowId
    //> Brace or statement terminator.
    });
    //> Variable declaration.
    const transferOutSnapshot = await recordAlphaContextPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      input: {
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        snapshotKind: "TRANSFER_OUT",
        //> Source statement or expression.
        predecessorSnapshotId: priorSnapshot?.id ?? null,
        //> Source statement or expression.
        sourceRef: handoverRef,
        //> Source statement or expression.
        handoverRef,
        //> Source statement or expression.
        continuityNote: continuityNote || lock.activeWindow.continuityNote || null,
        //> Source statement or expression.
        payloadSnapshot: {
          //> Source statement or expression.
          fromAgentKey: lock.activeWindow.ownerAgentKey,
          //> Source statement or expression.
          toAgentKey: target.agentKey,
          //> Source statement or expression.
          toWindowId: successorActive.id
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        createdById: params.actorUserId ?? null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Await async value.
    await recordAlphaContextPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      input: {
        //> Source statement or expression.
        windowId: successorActive.id,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        snapshotKind: "TRANSFER_IN",
        //> Source statement or expression.
        predecessorSnapshotId: transferOutSnapshot.id,
        //> Source statement or expression.
        sourceRef: handoverRef,
        //> Source statement or expression.
        handoverRef,
        //> Source statement or expression.
        continuityNote: continuityNote || null,
        //> Source statement or expression.
        payloadSnapshot: {
          //> Source statement or expression.
          fromWindowId: lock.activeWindowId,
          //> Source statement or expression.
          fromAgentKey: lock.activeWindow.ownerAgentKey,
          //> Source statement or expression.
          toAgentKey: target.agentKey
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        createdById: params.actorUserId ?? null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await tx.projectAlphaLock.update({
      //> Source statement or expression.
      where: { projectKey: project.projectKey },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        activeWindowId: successorActive.id,
        //> Source statement or expression.
        activeOwnerAgentKey: target.agentKey,
        //> Source statement or expression.
        continuityRef: handoverRef,
        //> Source statement or expression.
        activatedAt: now
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const reason =
      //> String literal line.
      `Alpha context lock transferred for project ${project.projectName}: ` +
      //> String literal line.
      `@${lock.activeWindow.ownerAgentKey} -> @${target.agentKey}.`;

    //> Await async value.
    await recordAudit(tx, {
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "TRANSFER_CONTEXT_WINDOW",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      windowId: successorActive.id,
      //> Source statement or expression.
      conflictingWindowId: lock.activeWindowId,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        fromWindowId: lock.activeWindowId,
        //> Source statement or expression.
        toWindowId: successorActive.id,
        //> Source statement or expression.
        fromAgentKey: lock.activeWindow.ownerAgentKey,
        //> Source statement or expression.
        toAgentKey: target.agentKey,
        //> Source statement or expression.
        handoverRef,
        //> Source statement or expression.
        actorUserId: params.actorUserId || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Return a value.
    return {
      //> Source statement or expression.
      ok: true,
      //> Source statement or expression.
      code: "CONTEXT_TRANSFERRED",
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName,
      //> Source statement or expression.
      activeWindowId: successorActive.id
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function closeActiveAlphaContextWindow(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  actorUserId?: string | null;
  //> Source statement or expression.
  handoverRef: string;
  //> Source statement or expression.
  closeReason?: string | null;
//> Source statement or expression.
}): Promise<AlphaContextMutationResult> {
  //> Variable declaration.
  const project = normalizeProjectIdentity(params.projectName);
  //> Variable declaration.
  const handoverRef = normalizeText(params.handoverRef);
  //> Variable declaration.
  const closeReason = normalizeText(params.closeReason);

  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureProjectLockRow({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const lock = await lockProjectRow(tx, project.projectKey);
    //> Conditional branch.
    if (!lock?.activeWindowId || !lock.activeWindow) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Alpha context close denied for project ${project.projectName}: no active window exists.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "CLOSE_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "CLOSE_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: null
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (!handoverRef) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `Alpha context close denied for project ${project.projectName}: handover package reference is required.`;
      //> Await async value.
      await recordAudit(tx, {
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "CLOSE_CONTEXT_WINDOW",
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          actorUserId: params.actorUserId || null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "CLOSE_DENIED",
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: denormalizeProject(lock, project),
        //> Source statement or expression.
        activeWindowId: lock.activeWindowId
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const now = new Date();
    //> Await async value.
    await tx.alphaContextWindow.update({
      //> Source statement or expression.
      where: { id: lock.activeWindowId },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        status: "CLOSED",
        //> Source statement or expression.
        closedAt: now,
        //> Source statement or expression.
        closeHandoverRef: handoverRef,
        //> Source statement or expression.
        continuityNote: closeReason || lock.activeWindow.continuityNote || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await recordAlphaContextPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      input: {
        //> Source statement or expression.
        windowId: lock.activeWindowId,
        //> Source statement or expression.
        projectKey: project.projectKey,
        //> Source statement or expression.
        projectName: project.projectName,
        //> Source statement or expression.
        snapshotKind: "CLOSED",
        //> Source statement or expression.
        sourceRef: handoverRef,
        //> Source statement or expression.
        handoverRef,
        //> Source statement or expression.
        continuityNote: closeReason || lock.activeWindow.continuityNote || null,
        //> Source statement or expression.
        payloadSnapshot: {
          //> Source statement or expression.
          ownerAgentKey: lock.activeWindow.ownerAgentKey
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        createdById: params.actorUserId ?? null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await tx.projectAlphaLock.update({
      //> Source statement or expression.
      where: { projectKey: project.projectKey },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        activeWindowId: null,
        //> Source statement or expression.
        activeOwnerAgentKey: null,
        //> Source statement or expression.
        continuityRef: handoverRef,
        //> Source statement or expression.
        activatedAt: null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const reason =
      //> String literal line.
      `Alpha context lock closed for project ${project.projectName} by @${lock.activeWindow.ownerAgentKey}.`;
    //> Await async value.
    await recordAudit(tx, {
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: denormalizeProject(lock, project),
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "CLOSE_CONTEXT_WINDOW",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      windowId: lock.activeWindowId,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        handoverRef,
        //> Source statement or expression.
        closeReason: closeReason || null,
        //> Source statement or expression.
        actorUserId: params.actorUserId || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Return a value.
    return {
      //> Source statement or expression.
      ok: true,
      //> Source statement or expression.
      code: "CONTEXT_CLOSED",
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      projectKey: project.projectKey,
      //> Source statement or expression.
      projectName: project.projectName,
      //> Source statement or expression.
      activeWindowId: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}
