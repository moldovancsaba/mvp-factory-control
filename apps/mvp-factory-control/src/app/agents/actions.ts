//> String literal line.
"use server";

/**
 * Server actions for agents: CRUD settings merge, readiness transitions, worker start/stop, lifecycle audits, RBAC operator.
 */
//> Import bindings from a module.
import { revalidatePath } from "next/cache";
//> Import bindings from a module.
import type { Prisma } from "@prisma/client";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  AGENT_NOT_READY_REASON,
  //> Source statement or expression.
  AGENT_PAUSED_REASON,
  //> Source statement or expression.
  normalizeReadinessInput
//> Source statement or expression.
} from "@/lib/agent-readiness";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  evaluateAgentReadinessTransition,
  //> Source statement or expression.
  evaluateTaskTransition,
  //> Source statement or expression.
  recordLifecycleAudit
//> Source statement or expression.
} from "@/lib/lifecycle-policy";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { requireRbacAccess } from "@/lib/rbac";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  mergeAgentSettings,
  //> Source statement or expression.
  removeAgentSetting,
  //> Source statement or expression.
  upsertAgentSetting
//> Source statement or expression.
} from "@/lib/settings-mutations";
//> Import bindings from a module.
import { startWorker, stopWorker } from "@/lib/worker-process";

//> Async function declaration.
async function requireOperatorAccess(action: string, entityId?: string, metadata?: Prisma.JsonObject) {
  //> Return a value.
  return requireRbacAccess({
    //> Source statement or expression.
    action,
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "AGENT",
    //> Source statement or expression.
    entityId: entityId || null,
    //> Source statement or expression.
    metadata
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function requireAdminAccess(action: string, entityId?: string, metadata?: Prisma.JsonObject) {
  //> Return a value.
  return requireRbacAccess({
    //> Source statement or expression.
    action,
    //> Source statement or expression.
    allowedRoles: ["ADMIN"],
    //> Source statement or expression.
    entityType: "AGENT",
    //> Source statement or expression.
    entityId: entityId || null,
    //> Source statement or expression.
    metadata
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeAgentKey(input: string) {
  //> Return a value.
  return input
    //> Source statement or expression.
    .trim()
    //> Source statement or expression.
    .replace(/^@+/, "")
    //> Source statement or expression.
    .replace(/\s+/g, "-")
    //> Source statement or expression.
    .replace(/[^A-Za-z0-9_-]/g, "");
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeRuntime(input: string): "LOCAL" | "CLOUD" {
  //> Conditional branch.
  if (input === "LOCAL" || input === "CLOUD") return input;
  //> Throw error.
  throw new Error("Runtime must be LOCAL or CLOUD.");
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeControlRole(input: string): "ALPHA" | "BETA" {
  //> Conditional branch.
  if (input === "ALPHA" || input === "BETA") return input;
  //> Throw error.
  throw new Error("Role must be ALPHA or BETA.");
//> Brace or statement terminator.
}

//> Function declaration.
function runtimeRank(runtime: "MANUAL" | "LOCAL" | "CLOUD") {
  //> Conditional branch.
  if (runtime === "LOCAL" || runtime === "CLOUD") return 2;
  //> Return a value.
  return 1;
//> Brace or statement terminator.
}

//> Function declaration.
function pickLatest(...values: Array<Date | null>) {
  //> Variable declaration.
  const present = values.filter((v): v is Date => Boolean(v));
  //> Conditional branch.
  if (!present.length) return null;
  //> Return a value.
  return new Date(Math.max(...present.map((v) => v.getTime())));
//> Brace or statement terminator.
}

//> Export declaration.
export async function createAgentAction(formData: FormData) {
  //> Variable declaration.
  const rawKey = String(formData.get("agentKey") || "");
  //> Variable declaration.
  const rawDisplayName = String(formData.get("displayName") || "").trim();
  //> Variable declaration.
  const runtime = normalizeRuntime(String(formData.get("runtime") || "").trim());
  //> Variable declaration.
  const controlRole = normalizeControlRole(String(formData.get("controlRole") || "BETA").trim());
  //> Variable declaration.
  const enabled = formData
    //> Source statement or expression.
    .getAll("enabled")
    //> Source statement or expression.
    .map((v) => String(v).trim())
    //> Source statement or expression.
    .includes("1");

  //> Variable declaration.
  const key = normalizeAgentKey(rawKey);
  //> Conditional branch.
  if (!key) throw new Error("Agent key is required.");
  //> Variable declaration.
  const displayName = rawDisplayName || key;

  //> Await async value.
  await requireOperatorAccess("AGENTS_CREATE_OR_UPDATE_AGENT", key, {
    //> Source statement or expression.
    runtime,
    //> Source statement or expression.
    controlRole
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const existing = await prisma.agent.findFirst({
    //> Source statement or expression.
    where: { key: { equals: key, mode: "insensitive" } },
    //> Source statement or expression.
    select: { key: true, runtime: true }
  //> Brace or statement terminator.
  });

  //> Conditional branch.
  if (!existing?.key) {
    //> Await async value.
    await prisma.agent.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        key,
        //> Source statement or expression.
        displayName,
        //> Source statement or expression.
        runtime,
        //> Source statement or expression.
        controlRole,
        //> Source statement or expression.
        enabled,
        //> Source statement or expression.
        readiness: "NOT_READY",
        //> Source statement or expression.
        smokeTestPassedAt: null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
  //> Source statement or expression.
  } else {
    //> Variable declaration.
    const runtimeChanged = existing.runtime !== runtime;
    //> Await async value.
    await prisma.agent.update({
      //> Source statement or expression.
      where: { key: existing.key },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        displayName,
        //> Source statement or expression.
        runtime,
        //> Source statement or expression.
        controlRole,
        //> Source statement or expression.
        enabled,
        //> Source statement or expression.
        ...(runtimeChanged
          //> Source statement or expression.
          ? { readiness: "NOT_READY", smokeTestPassedAt: null }
          //> Source statement or expression.
          : {})
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Source statement or expression.
  revalidatePath("/agents");
  //> Source statement or expression.
  revalidatePath("/chat");
//> Brace or statement terminator.
}

//> Export declaration.
export async function startAgentWorkerAction(formData: FormData) {
  //> Variable declaration.
  const agentKey = String(formData.get("agentKey") || "").trim();
  //> Conditional branch.
  if (!agentKey) throw new Error("Missing agent key.");
  //> Await async value.
  await requireOperatorAccess("AGENTS_START_WORKER", agentKey);
  //> Await async value.
  await startWorker(agentKey);
  //> Source statement or expression.
  revalidatePath("/agents");
//> Brace or statement terminator.
}

//> Export declaration.
export async function stopAgentWorkerAction(formData: FormData) {
  //> Variable declaration.
  const agentKey = String(formData.get("agentKey") || "").trim();
  //> Conditional branch.
  if (!agentKey) throw new Error("Missing agent key.");
  //> Await async value.
  await requireOperatorAccess("AGENTS_STOP_WORKER", agentKey);
  //> Await async value.
  await stopWorker(agentKey);
  //> Source statement or expression.
  revalidatePath("/agents");
//> Brace or statement terminator.
}

//> Export declaration.
export async function saveAgentConfigAction(formData: FormData) {
  //> Variable declaration.
  const agentId = String(formData.get("agentId") || "").trim();
  //> Variable declaration.
  const agentName = String(formData.get("agentName") || "").trim();
  //> Variable declaration.
  const agentUrl = String(formData.get("agentUrl") || "").trim();
  //> Variable declaration.
  const agentModel = String(formData.get("agentModel") || "").trim();
  //> Variable declaration.
  const agentApiKeyEnv = String(formData.get("agentApiKeyEnv") || "").trim();

  //> Variable declaration.
  const auth = await requireOperatorAccess("AGENTS_SAVE_AGENT_CONFIG", agentName || agentId || undefined, {
    //> Source statement or expression.
    hasAgentUrl: Boolean(agentUrl),
    //> Source statement or expression.
    hasModel: Boolean(agentModel),
    //> Source statement or expression.
    hasApiKeyEnv: Boolean(agentApiKeyEnv)
  //> Brace or statement terminator.
  });

  //> Await async value.
  await upsertAgentSetting({
    //> Source statement or expression.
    agentId: agentId || undefined,
    //> Source statement or expression.
    agentName,
    //> Source statement or expression.
    agentUrl,
    //> Source statement or expression.
    agentModel,
    //> Source statement or expression.
    agentApiKeyEnv
  //> Source statement or expression.
  }, {
    //> Source statement or expression.
    auditContext: {
      //> Source statement or expression.
      actorRole: `RBAC_${auth.role}`,
      //> Source statement or expression.
      actorUserId: auth.userId,
      //> Source statement or expression.
      actorUserEmail: auth.userEmail
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/agents");
  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}

//> Export declaration.
export async function updateAgentReadinessAction(formData: FormData) {
  //> Variable declaration.
  const agentKey = String(formData.get("agentKey") || "").trim();
  //> Variable declaration.
  const readinessRaw = String(formData.get("readiness") || "").trim();
  //> Conditional branch.
  if (!agentKey) throw new Error("Missing agent key.");
  //> Await async value.
  await requireOperatorAccess("AGENTS_UPDATE_READINESS", agentKey, {
    //> Source statement or expression.
    requestedReadiness: readinessRaw
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const readiness = normalizeReadinessInput(readinessRaw);
  //> Variable declaration.
  const current = await prisma.agent.findUnique({
    //> Source statement or expression.
    where: { key: agentKey },
    //> Source statement or expression.
    select: { key: true, readiness: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!current) throw new Error(`Agent @${agentKey} not found.`);

  //> Variable declaration.
  const decision = evaluateAgentReadinessTransition({
    //> Source statement or expression.
    actorRole: "HUMAN_OPERATOR",
    //> Source statement or expression.
    action: "SET_READINESS",
    //> Source statement or expression.
    fromState: current.readiness,
    //> Source statement or expression.
    toState: readiness
  //> Brace or statement terminator.
  });

  //> Await async value.
  await prisma.$transaction(async (tx) => {
    //> Conditional branch.
    if (!decision.allowed) {
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "AGENT",
        //> Source statement or expression.
        entityId: agentKey,
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "SET_READINESS",
        //> Source statement or expression.
        fromState: current.readiness,
        //> Source statement or expression.
        toState: readiness,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: decision.reason,
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });
      //> Throw error.
      throw new Error(decision.reason);
    //> Brace or statement terminator.
    }

    //> Await async value.
    await tx.agent.update({
      //> Source statement or expression.
      where: { key: agentKey },
      //> Source statement or expression.
      data: { readiness }
    //> Brace or statement terminator.
    });

    //> Conditional branch.
    if (readiness === "NOT_READY") {
      //> Await async value.
      await tx.agentTask.updateMany({
        //> Source statement or expression.
        where: { agentKey, status: "QUEUED" },
        //> Source statement or expression.
        data: { error: AGENT_NOT_READY_REASON }
      //> Brace or statement terminator.
      });
    //> Source statement or expression.
    } else if (readiness === "PAUSED") {
      //> Await async value.
      await tx.agentTask.updateMany({
        //> Source statement or expression.
        where: { agentKey, status: "QUEUED" },
        //> Source statement or expression.
        data: { error: AGENT_PAUSED_REASON }
      //> Brace or statement terminator.
      });
    //> Source statement or expression.
    } else {
      //> Await async value.
      await tx.agentTask.updateMany({
        //> Source statement or expression.
        where: { agentKey, status: "QUEUED" },
        //> Source statement or expression.
        data: { error: null }
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }

    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "AGENT",
      //> Source statement or expression.
      entityId: agentKey,
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "SET_READINESS",
      //> Source statement or expression.
      fromState: current.readiness,
      //> Source statement or expression.
      toState: readiness,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: decision.reason,
      //> Source statement or expression.
      db: tx
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/agents");
  //> Source statement or expression.
  revalidatePath("/chat");
//> Brace or statement terminator.
}

//> Export declaration.
export async function adminOverrideManualRequiredAction(formData: FormData) {
  //> Variable declaration.
  const agentKey = String(formData.get("agentKey") || "").trim();
  //> Variable declaration.
  const reasonInput = String(formData.get("reason") || "").trim();
  //> Conditional branch.
  if (!agentKey) throw new Error("Missing agent key.");
  //> Await async value.
  await requireAdminAccess("AGENTS_ADMIN_OVERRIDE_MANUAL_REQUIRED", agentKey, {
    //> Source statement or expression.
    hasReason: Boolean(reasonInput)
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const reason =
    //> Source statement or expression.
    reasonInput || "Manual override: operator forced manual-required lifecycle state.";

  //> Variable declaration.
  const tasks = await prisma.agentTask.findMany({
    //> Source statement or expression.
    where: {
      //> Source statement or expression.
      agentKey,
      //> Source statement or expression.
      status: { in: ["QUEUED", "RUNNING"] }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    select: { id: true, status: true }
  //> Brace or statement terminator.
  });

  //> Await async value.
  await prisma.$transaction(async (tx) => {
    //> Variable declaration.
    let transitioned = 0;
    //> Variable declaration.
    let denied = 0;

    //> For-loop header.
    for (const task of tasks) {
      // eslint-disable-next-line no-await-in-loop
      //> Variable declaration.
      const decision = evaluateTaskTransition({
        //> Source statement or expression.
        actorRole: "ADMIN_OVERRIDE",
        //> Source statement or expression.
        action: "FORCE_MANUAL_REQUIRED",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: "MANUAL_REQUIRED"
      //> Brace or statement terminator.
      });

      //> Conditional branch.
      if (!decision.allowed) {
        //> Source statement or expression.
        denied += 1;
        // eslint-disable-next-line no-await-in-loop
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ADMIN_OVERRIDE",
          //> Source statement or expression.
          action: "FORCE_MANUAL_REQUIRED",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: "MANUAL_REQUIRED",
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: decision.reason,
          //> Source statement or expression.
          db: tx
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        continue;
      //> Brace or statement terminator.
      }

      //> Source statement or expression.
      transitioned += 1;
      // eslint-disable-next-line no-await-in-loop
      //> Await async value.
      await tx.agentTask.update({
        //> Source statement or expression.
        where: { id: task.id },
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          status: "MANUAL_REQUIRED",
          //> Source statement or expression.
          finishedAt: new Date(),
          //> Source statement or expression.
          error: reason
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });

      // eslint-disable-next-line no-await-in-loop
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "ADMIN_OVERRIDE",
        //> Source statement or expression.
        action: "FORCE_MANUAL_REQUIRED",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: "MANUAL_REQUIRED",
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        reason: decision.reason,
        //> Source statement or expression.
        metadata: { reason },
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }

    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "AGENT",
      //> Source statement or expression.
      entityId: agentKey,
      //> Source statement or expression.
      actorRole: "ADMIN_OVERRIDE",
      //> Source statement or expression.
      action: "FORCE_MANUAL_REQUIRED",
      //> Source statement or expression.
      fromState: null,
      //> Source statement or expression.
      toState: null,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: `Manual override completed. transitioned=${transitioned}, denied=${denied}.`,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        transitioned,
        //> Source statement or expression.
        denied,
        //> Source statement or expression.
        reason
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db: tx
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/agents");
  //> Source statement or expression.
  revalidatePath("/chat");
//> Brace or statement terminator.
}

//> Export declaration.
export async function updateAgentSmokeTestAction(formData: FormData) {
  //> Variable declaration.
  const agentKey = String(formData.get("agentKey") || "").trim();
  //> Variable declaration.
  const passed = String(formData.get("passed") || "").trim() === "1";
  //> Conditional branch.
  if (!agentKey) throw new Error("Missing agent key.");
  //> Await async value.
  await requireOperatorAccess("AGENTS_UPDATE_SMOKE_TEST", agentKey, { passed });

  //> Await async value.
  await prisma.agent.update({
    //> Source statement or expression.
    where: { key: agentKey },
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      smokeTestPassedAt: passed ? new Date() : null
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/agents");
//> Brace or statement terminator.
}

//> Export declaration.
export async function deleteAgentConfigAction(formData: FormData) {
  //> Variable declaration.
  const agentId = String(formData.get("agentId") || "").trim();
  //> Variable declaration.
  const agentName = String(formData.get("agentName") || "").trim();
  //> Await async value.
  await requireOperatorAccess("AGENTS_DELETE_AGENT_CONFIG", agentName || agentId || undefined);

  //> Await async value.
  await removeAgentSetting({
    //> Source statement or expression.
    agentId: agentId || undefined,
    //> Source statement or expression.
    agentName: agentName || undefined
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/agents");
  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}

//> Export declaration.
export async function mergeCaseVariantAgentKeysAction(formData: FormData) {
  //> Variable declaration.
  const canonicalKey = String(formData.get("canonicalKey") || "").trim();
  //> Conditional branch.
  if (!canonicalKey) throw new Error("Missing canonical key.");
  //> Await async value.
  await requireAdminAccess("AGENTS_MERGE_CASE_VARIANT_KEYS", canonicalKey);

  //> Variable declaration.
  const target = await prisma.agent.findUnique({
    //> Source statement or expression.
    where: { key: canonicalKey }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!target) throw new Error(`Agent @${canonicalKey} not found.`);

  //> Variable declaration.
  const duplicates = await prisma.agent.findMany({
    //> Source statement or expression.
    where: {
      //> Source statement or expression.
      key: { equals: canonicalKey, mode: "insensitive" }
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (duplicates.length < 2) {
    //> Source statement or expression.
    revalidatePath("/agents");
    //> Return to caller.
    return;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const sources = duplicates.filter((row) => row.key !== target.key);
  //> Variable declaration.
  const runtimeWinner =
    //> Source statement or expression.
    duplicates
      //> Source statement or expression.
      .slice()
      //> Source statement or expression.
      .sort((a, b) => runtimeRank(b.runtime) - runtimeRank(a.runtime))[0] || target;
  //> Variable declaration.
  const mergedModel =
    //> Source statement or expression.
    target.model ||
    //> Source statement or expression.
    runtimeWinner.model ||
    //> Source statement or expression.
    sources.map((row) => row.model).find((value) => Boolean(value)) ||
    //> Source statement or expression.
    null;
  //> Variable declaration.
  const mergedHost =
    //> Source statement or expression.
    target.host ||
    //> Source statement or expression.
    runtimeWinner.host ||
    //> Source statement or expression.
    sources.map((row) => row.host).find((value) => Boolean(value)) ||
    //> Source statement or expression.
    null;
  //> Variable declaration.
  const mergedCapabilities =
    //> Source statement or expression.
    target.capabilities ??
    //> Source statement or expression.
    runtimeWinner.capabilities ??
    //> Source statement or expression.
    sources.map((row) => row.capabilities).find((value) => value !== null) ??
    //> Source statement or expression.
    undefined;
  //> Variable declaration.
  const nextRuntime =
    //> Source statement or expression.
    target.runtime === "MANUAL" && runtimeRank(runtimeWinner.runtime) > runtimeRank(target.runtime)
      //> Source statement or expression.
      ? runtimeWinner.runtime
      //> Source statement or expression.
      : target.runtime;
  //> Variable declaration.
  const nextReadiness =
    //> Source statement or expression.
    target.runtime === "MANUAL" && runtimeWinner.runtime !== "MANUAL"
      //> Source statement or expression.
      ? runtimeWinner.readiness
      //> Source statement or expression.
      : target.readiness;
  //> Variable declaration.
  const nextSmoke = pickLatest(
    //> Source statement or expression.
    target.smokeTestPassedAt,
    //> Source statement or expression.
    ...sources.map((row) => row.smokeTestPassedAt)
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const nextHeartbeat = pickLatest(
    //> Source statement or expression.
    target.lastHeartbeatAt,
    //> Source statement or expression.
    ...sources.map((row) => row.lastHeartbeatAt)
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const heartbeatSource = [target, ...sources]
    //> Source statement or expression.
    .filter((row) => row.lastHeartbeatAt)
    //> Source statement or expression.
    .sort(
      //> Source statement or expression.
      (a, b) =>
        //> Source statement or expression.
        (b.lastHeartbeatAt?.getTime() || 0) - (a.lastHeartbeatAt?.getTime() || 0)
    //> Source statement or expression.
    )[0];

  //> Await async value.
  await prisma.$transaction(async (tx) => {
    //> Await async value.
    await tx.agent.update({
      //> Source statement or expression.
      where: { key: target.key },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        displayName: target.displayName || runtimeWinner.displayName || target.key,
        //> Source statement or expression.
        runtime: nextRuntime,
        //> Source statement or expression.
        readiness: nextReadiness,
        //> Source statement or expression.
        enabled: duplicates.some((row) => row.enabled),
        //> Source statement or expression.
        smokeTestPassedAt: nextSmoke,
        //> Source statement or expression.
        model: mergedModel,
        //> Source statement or expression.
        host: mergedHost,
        //> Source statement or expression.
        capabilities: mergedCapabilities,
        //> Source statement or expression.
        lastHeartbeatAt: nextHeartbeat,
        //> Source statement or expression.
        lastHeartbeatMeta:
          //> Source statement or expression.
          target.lastHeartbeatMeta ?? heartbeatSource?.lastHeartbeatMeta ?? undefined
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> For-loop header.
    for (const source of sources) {
      // eslint-disable-next-line no-await-in-loop
      //> Await async value.
      await tx.agentTask.updateMany({
        //> Source statement or expression.
        where: { agentKey: source.key },
        //> Source statement or expression.
        data: { agentKey: target.key }
      //> Brace or statement terminator.
      });
      // eslint-disable-next-line no-await-in-loop
      //> Await async value.
      await tx.agent.delete({
        //> Source statement or expression.
        where: { key: source.key }
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Await async value.
  await mergeAgentSettings({
    //> Source statement or expression.
    canonicalName: target.key,
    //> Source statement or expression.
    aliases: sources.map((row) => row.key)
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/agents");
  //> Source statement or expression.
  revalidatePath("/chat");
  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}
