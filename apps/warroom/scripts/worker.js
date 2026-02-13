/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const {
  summarizeToolCallProtocolEnvelope,
  validateToolCallProtocolEnvelope
} = require("./lib/tool-call-protocol");
const {
  buildToolCallActionFingerprint,
  verifyToolCallApprovalToken
} = require("./lib/tool-call-approval");
const {
  evaluateToolCommandPolicy,
  summarizeToolCommandPolicyEvaluation
} = require("./lib/tool-command-policy");

const prisma = new PrismaClient();

function argValue(prefix) {
  const found = process.argv.find((a) => a.startsWith(`${prefix}=`));
  if (!found) return null;
  return found.slice(prefix.length + 1);
}

const RAW_AGENT_KEY =
  argValue("--agent") || process.env.WARROOM_WORKER_AGENT_KEY || null;
const POLL_MS = Number(process.env.WARROOM_WORKER_POLL_MS || "1200");
const WORKER_MODEL = process.env.WARROOM_WORKER_MODEL || null;
const WORKER_HOST = process.env.WARROOM_WORKER_HOST || os.hostname();
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "deepseek-r1:1.5b";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const GITHUB_TOKEN =
  process.env.WARROOM_GITHUB_TOKEN ||
  process.env.GITHUB_TOKEN ||
  process.env.MVP_PROJECT_TOKEN ||
  null;
const GITHUB_PROJECT_OWNER =
  process.env.WARROOM_GITHUB_PROJECT_OWNER || "moldovancsaba";
const GITHUB_PROJECT_NUMBER = Number(
  process.env.WARROOM_GITHUB_PROJECT_NUMBER || "1"
);
const SETTINGS_FILE = path.join(__dirname, "..", ".warroom", "settings.json");

let cachedProjectMeta = null;
let WORKER_AGENT_KEY = RAW_AGENT_KEY;
let WORKER_CONTROL_ROLE = null;
let CLAIM_ALL_TASKS = false;
const NOT_READY_REASON =
  "Agent readiness is NOT_READY. Complete the readiness checklist and switch the agent to READY.";
const PAUSED_REASON =
  "Agent readiness is PAUSED. Task is queued and will execute after switching back to READY.";
const DEFAULT_MAX_ATTEMPTS = Number(process.env.WARROOM_TASK_MAX_ATTEMPTS || "3");
const RETRY_BASE_MS = Number(process.env.WARROOM_TASK_RETRY_BASE_MS || "5000");
const RETRY_MAX_MS = Number(process.env.WARROOM_TASK_RETRY_MAX_MS || "300000");
const RETRY_JITTER_MS = Number(process.env.WARROOM_TASK_RETRY_JITTER_MS || "750");
const REQUEST_TIMEOUT_MS = Number(
  process.env.WARROOM_WORKER_REQUEST_TIMEOUT_MS || "60000"
);
const ORCHESTRATOR_LEASE_ID =
  process.env.WARROOM_ORCHESTRATOR_LEASE_ID || "warroom-primary-orchestrator";
const ORCHESTRATOR_LEASE_TTL_MS = clampInt(
  process.env.WARROOM_ORCHESTRATOR_LEASE_TTL_MS || "20000",
  20_000,
  5_000,
  300_000
);
const ORCHESTRATOR_STALE_RUNNING_MS = clampInt(
  process.env.WARROOM_ORCHESTRATOR_STALE_RUNNING_MS || String(Math.max(ORCHESTRATOR_LEASE_TTL_MS * 2, 30_000)),
  Math.max(ORCHESTRATOR_LEASE_TTL_MS * 2, 30_000),
  ORCHESTRATOR_LEASE_TTL_MS,
  3_600_000
);
const ORCHESTRATOR_OWNER_ID = [
  WORKER_HOST,
  process.pid,
  RAW_AGENT_KEY || "ANY",
  Date.now().toString(36)
].join(":");

class WorkerTaskError extends Error {
  constructor(code, message, retryable) {
    super(message);
    this.name = "WorkerTaskError";
    this.code = code;
    this.retryable = Boolean(retryable);
  }
}

function clampInt(input, fallback, min, max) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function normalizeTaskLimits(task) {
  const maxAttempts = clampInt(task?.maxAttempts, clampInt(DEFAULT_MAX_ATTEMPTS, 3, 1, 10), 1, 10);
  const attemptCount = clampInt(task?.attemptCount, 0, 0, 1000);
  return { maxAttempts, attemptCount };
}

function computeRetryDelayMs(attemptCount) {
  const step = Math.max(attemptCount, 1) - 1;
  const base = clampInt(RETRY_BASE_MS, 5000, 250, 60_000);
  const max = clampInt(RETRY_MAX_MS, 300000, base, 3_600_000);
  const jitter = clampInt(RETRY_JITTER_MS, 750, 0, 10_000);
  const raw = Math.min(base * 2 ** step, max);
  const variance = jitter ? Math.floor(Math.random() * (jitter + 1)) : 0;
  return Math.min(raw + variance, max);
}

function formatFailureMessage(failure) {
  return `[${failure.code}] ${failure.message}`;
}

function failureMeta(failure, attemptCount, maxAttempts) {
  return {
    code: failure.code,
    retryable: failure.retryable,
    attemptCount,
    maxAttempts
  };
}

function normalizeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function readTaskToolCallApprovalToken(payload) {
  const payloadRecord = asRecord(payload);
  return normalizeText(payloadRecord?.toolCallApprovalToken) || null;
}

function readTaskToolCallPolicy(payload) {
  const payloadRecord = asRecord(payload);
  const policy = asRecord(payloadRecord?.toolCallPolicy);
  return {
    dryRun: Boolean(policy?.dryRun)
  };
}

function readTaskRuntimeConfigResolution(payload) {
  const payloadRecord = asRecord(payload);
  const resolution = asRecord(payloadRecord?.runtimeConfigResolution);
  if (!resolution) return null;

  const effective = asRecord(resolution.effective);
  if (!effective) return null;

  const runtime = normalizeText(effective.runtime).toUpperCase();
  if (runtime !== "LOCAL" && runtime !== "CLOUD") return null;

  const endpoint = normalizeText(effective.endpoint);
  const model = normalizeText(effective.model);
  const apiKeyEnv = normalizeText(effective.apiKeyEnv) || null;
  const requestTimeoutMs = clampInt(
    effective.requestTimeoutMs,
    clampInt(REQUEST_TIMEOUT_MS, 60000, 1000, 300000),
    1000,
    300000
  );

  return {
    digest: normalizeText(resolution.digest) || null,
    projectKey: normalizeText(resolution.projectKey) || null,
    projectName: normalizeText(resolution.projectName) || null,
    activeContextWindowId: normalizeText(resolution.activeContextWindowId) || null,
    activeContextOwnerAgentKey: normalizeText(resolution.activeContextOwnerAgentKey) || null,
    sourceChain: Array.isArray(resolution.sourceChain) ? resolution.sourceChain : [],
    effective: {
      runtime,
      endpoint,
      model,
      apiKeyEnv,
      requestTimeoutMs
    }
  };
}

function evaluateOrchestratorTaskTransition(action, fromState, toState) {
  if (action === "ROUTE_HANDOFF_TASK") {
    if (fromState !== null) {
      return { allowed: false, reason: "Handoff task creation requires fromState=null." };
    }
    if (toState === "QUEUED" || toState === "MANUAL_REQUIRED") {
      return { allowed: true, reason: "Orchestrator handoff creation transition allowed." };
    }
    return {
      allowed: false,
      reason: "Handoff task creation can only target QUEUED or MANUAL_REQUIRED."
    };
  }
  if (action === "CLAIM_TASK") {
    return fromState === "QUEUED" && toState === "RUNNING"
      ? { allowed: true, reason: "Orchestrator claim transition allowed." }
      : { allowed: false, reason: "Claim transition requires QUEUED -> RUNNING." };
  }
  if (action === "COMPLETE_TASK") {
    return fromState === "RUNNING" && toState === "DONE"
      ? { allowed: true, reason: "Orchestrator completion transition allowed." }
      : { allowed: false, reason: "Completion transition requires RUNNING -> DONE." };
  }
  if (action === "RETRY_TASK") {
    return fromState === "RUNNING" && toState === "QUEUED"
      ? { allowed: true, reason: "Orchestrator retry transition allowed." }
      : { allowed: false, reason: "Retry transition requires RUNNING -> QUEUED." };
  }
  if (action === "DEAD_LETTER_TASK") {
    return fromState === "RUNNING" && toState === "DEAD_LETTER"
      ? { allowed: true, reason: "Orchestrator dead-letter transition allowed." }
      : {
          allowed: false,
          reason: "Dead-letter transition requires RUNNING -> DEAD_LETTER."
        };
  }
  if (action === "RECOVER_STALE_RUNNING") {
    return fromState === "RUNNING" && toState === "QUEUED"
      ? { allowed: true, reason: "Stale-running recovery transition allowed." }
      : {
          allowed: false,
          reason: "Stale-running recovery requires RUNNING -> QUEUED."
        };
  }
  return { allowed: false, reason: `Unsupported orchestrator task action: ${action}.` };
}

async function recordLifecycleAudit(entry, db = prisma) {
  await db.lifecycleAuditEvent.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      actorRole: entry.actorRole,
      action: entry.action,
      fromState: entry.fromState || null,
      toState: entry.toState || null,
      allowed: Boolean(entry.allowed),
      reason: entry.reason,
      metadata: entry.metadata || undefined
    }
  });
}

async function verifyAndConsumeToolCallApproval(params) {
  const { task, envelope, policyEvaluation, payload } = params;
  if (!policyEvaluation.requiresApproval) {
    return null;
  }

  const actionFingerprint = buildToolCallActionFingerprint(envelope);
  const approvalToken = readTaskToolCallApprovalToken(payload);
  if (!approvalToken) {
    const reason =
      policyEvaluation.approvalReason ||
      "Tool command policy requires explicit approval token before execution.";
    await recordLifecycleAudit({
      entityType: "TASK",
      entityId: task.id,
      actorRole: "ORCHESTRATOR",
      action: "TOOL_CALL_APPROVAL_VERIFY",
      fromState: task.status,
      toState: task.status,
      allowed: false,
      reason,
      metadata: {
        code: "TOKEN_MISSING",
        actionFingerprint
      }
    });
    throw new WorkerTaskError("TOOL_CALL_APPROVAL_REQUIRED", reason, false);
  }

  const verification = verifyToolCallApprovalToken({
    token: approvalToken,
    expectedActionFingerprint: actionFingerprint
  });
  if (!verification.ok) {
    await recordLifecycleAudit({
      entityType: "TASK",
      entityId: task.id,
      actorRole: "ORCHESTRATOR",
      action: "TOOL_CALL_APPROVAL_VERIFY",
      fromState: task.status,
      toState: task.status,
      allowed: false,
      reason: verification.reason,
      metadata: {
        code: verification.code,
        tokenId: verification.tokenId,
        actionFingerprint
      }
    });
    if (verification.tokenId) {
      await recordLifecycleAudit({
        entityType: "TOOL_APPROVAL_TOKEN",
        entityId: verification.tokenId,
        actorRole: "ORCHESTRATOR",
        action: "CONSUME_APPROVAL_TOKEN",
        fromState: null,
        toState: null,
        allowed: false,
        reason: verification.reason,
        metadata: {
          code: verification.code,
          taskId: task.id,
          actionFingerprint
        }
      });
    }
    throw new WorkerTaskError("TOOL_CALL_APPROVAL_INVALID", verification.reason, false);
  }

  const priorUse = await prisma.lifecycleAuditEvent.findFirst({
    where: {
      entityType: "TOOL_APPROVAL_TOKEN",
      entityId: verification.payload.tokenId,
      action: "CONSUME_APPROVAL_TOKEN",
      allowed: true
    },
    select: { id: true }
  });
  if (priorUse) {
    const reason = "Approval token replay rejected: token was already consumed.";
    await recordLifecycleAudit({
      entityType: "TASK",
      entityId: task.id,
      actorRole: "ORCHESTRATOR",
      action: "TOOL_CALL_APPROVAL_VERIFY",
      fromState: task.status,
      toState: task.status,
      allowed: false,
      reason,
      metadata: {
        code: "TOKEN_REPLAY",
        tokenId: verification.payload.tokenId,
        actionFingerprint
      }
    });
    await recordLifecycleAudit({
      entityType: "TOOL_APPROVAL_TOKEN",
      entityId: verification.payload.tokenId,
      actorRole: "ORCHESTRATOR",
      action: "CONSUME_APPROVAL_TOKEN",
      fromState: null,
      toState: null,
      allowed: false,
      reason,
      metadata: {
        code: "TOKEN_REPLAY",
        taskId: task.id,
        actionFingerprint
      }
    });
    throw new WorkerTaskError("TOOL_CALL_APPROVAL_REPLAY", reason, false);
  }

  await recordLifecycleAudit({
    entityType: "TOOL_APPROVAL_TOKEN",
    entityId: verification.payload.tokenId,
    actorRole: "ORCHESTRATOR",
    action: "CONSUME_APPROVAL_TOKEN",
    fromState: null,
    toState: "CONSUMED",
    allowed: true,
    reason: "Approval token consumed for tool-call execution.",
    metadata: {
      taskId: task.id,
      actionFingerprint,
      approverUserId: verification.payload.approverUserId,
      approverEmail: verification.payload.approverEmail,
      expiresAt: verification.payload.expiresAt
    }
  });

  await recordLifecycleAudit({
    entityType: "TASK",
    entityId: task.id,
    actorRole: "ORCHESTRATOR",
    action: "TOOL_CALL_APPROVAL_VERIFY",
    fromState: task.status,
    toState: task.status,
    allowed: true,
    reason: "Tool-call approval token verified and consumed.",
    metadata: {
      tokenId: verification.payload.tokenId,
      approverUserId: verification.payload.approverUserId,
      approverEmail: verification.payload.approverEmail,
      actionFingerprint,
      expiresAt: verification.payload.expiresAt
    }
  });

  return verification.payload;
}

function failurePolicy(className) {
  if (className === "STALE_RUNNING_DETECTED") {
    return {
      severity: "MEDIUM",
      fallbackAction: "REQUEUE",
      remediation:
        "Inspect stale-running owner context and verify orchestrator lease recovery before further retries."
    };
  }
  if (className === "EXECUTION_RETRY_EXHAUSTED") {
    return {
      severity: "HIGH",
      fallbackAction: "DEAD_LETTER",
      remediation:
        "Review dead-letter diagnostics and route to manual-required remediation if autonomous retry is exhausted."
    };
  }
  return {
    severity: "LOW",
    fallbackAction: "ALERT_ONLY",
    remediation: "Review fallback diagnostics."
  };
}

async function recordAlphaFailureEvent(entry, db = prisma) {
  const policy = failurePolicy(entry.failureClass);
  await db.alphaFailureEvent.create({
    data: {
      failureClass: entry.failureClass,
      severity: policy.severity,
      fallbackAction: policy.fallbackAction,
      projectKey: entry.projectKey || null,
      projectName: entry.projectName || null,
      issueNumber: entry.issueNumber ?? null,
      taskId: entry.taskId || null,
      threadId: entry.threadId || null,
      leaseHealth: entry.leaseHealth || null,
      contextWindowId: entry.contextWindowId || null,
      remediation: policy.remediation,
      metadata: entry.metadata || undefined
    }
  });
}

function isoOrNull(value) {
  if (!(value instanceof Date)) return null;
  return value.toISOString();
}

let leaseHeld = false;
let isShuttingDown = false;
let lastLeaseConflictKey = null;
let lastLeaseConflictAt = 0;

function readAgentSetting(agentKey) {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const all = Array.isArray(parsed?.agents) ? parsed.agents : [];
    const wanted = normalizeLower(agentKey);
    const row = all.find(
      (r) =>
        r &&
        typeof r === "object" &&
        typeof r.agentName === "string" &&
        normalizeLower(r.agentName) === wanted
    );
    if (!row) return null;
    return {
      agentUrl: typeof row.agentUrl === "string" ? row.agentUrl.trim() : "",
      agentModel: typeof row.agentModel === "string" ? row.agentModel.trim() : "",
      agentApiKeyEnv:
        typeof row.agentApiKeyEnv === "string" ? row.agentApiKeyEnv.trim() : ""
    };
  } catch {
    return null;
  }
}

function readEnvVar(name) {
  if (!name) return "";
  return String(process.env[name] || "").trim();
}

function resolveAgentExecutionConfig(agent, runtimeResolution = null) {
  if (!agent || !agent.key) {
    throw new Error("Missing agent record.");
  }
  const setting = readAgentSetting(agent.key);
  const displayName = agent.displayName || agent.key;
  const resolutionEffective = runtimeResolution?.effective || null;
  const runtimeMatches = resolutionEffective?.runtime === agent.runtime;
  const timeoutOverride = runtimeMatches ? resolutionEffective.requestTimeoutMs : null;

  if (agent.runtime === "LOCAL") {
    const resolved = {
      runtime: "LOCAL",
      provider: "ollama",
      displayName,
      endpoint: setting?.agentUrl || OLLAMA_BASE_URL,
      model: setting?.agentModel || agent.model || WORKER_MODEL || OLLAMA_MODEL,
      apiKey: null,
      apiKeyEnv: "",
      requestTimeoutMs: clampInt(timeoutOverride ?? REQUEST_TIMEOUT_MS, 60000, 1000, 300000),
      runtimeConfigDigest: runtimeResolution?.digest || null,
      runtimeConfigSourceChain: runtimeResolution?.sourceChain || []
    };
    if (runtimeMatches) {
      if (resolutionEffective.endpoint) resolved.endpoint = resolutionEffective.endpoint;
      if (resolutionEffective.model) resolved.model = resolutionEffective.model;
    }
    return resolved;
  }

  if (agent.runtime === "CLOUD") {
    const apiKeyEnv =
      (runtimeMatches && resolutionEffective.apiKeyEnv) ||
      setting?.agentApiKeyEnv ||
      "OPENAI_API_KEY";
    const apiKey = readEnvVar(apiKeyEnv) || OPENAI_API_KEY || "";
    const resolved = {
      runtime: "CLOUD",
      provider: "openai",
      displayName,
      endpoint: setting?.agentUrl || OPENAI_BASE_URL,
      model: setting?.agentModel || agent.model || OPENAI_MODEL,
      apiKey,
      apiKeyEnv,
      requestTimeoutMs: clampInt(timeoutOverride ?? REQUEST_TIMEOUT_MS, 60000, 1000, 300000),
      runtimeConfigDigest: runtimeResolution?.digest || null,
      runtimeConfigSourceChain: runtimeResolution?.sourceChain || []
    };
    if (runtimeMatches) {
      if (resolutionEffective.endpoint) resolved.endpoint = resolutionEffective.endpoint;
      if (resolutionEffective.model) resolved.model = resolutionEffective.model;
    }
    return resolved;
  }

  throw new Error(
    `Unsupported runtime "${agent.runtime}" for @${agent.key}. Set runtime to LOCAL or CLOUD.`
  );
}

async function resolveCanonicalAgentKey(rawAgentKey) {
  if (!rawAgentKey) return null;
  const existing = await prisma.agent.findFirst({
    where: { key: { equals: rawAgentKey, mode: "insensitive" } },
    select: { key: true }
  });
  if (!existing?.key) {
    throw new Error(
      `Worker agent "${rawAgentKey}" is not registered. Create it on /agents first.`
    );
  }
  return existing.key;
}

async function heartbeat(agentKey, leaseMeta = {}) {
  if (!agentKey) return;
  const existing = await prisma.agent.findFirst({
    where: { key: { equals: agentKey, mode: "insensitive" } },
    select: { key: true, displayName: true, runtime: true, model: true }
  });
  if (!existing?.key) {
    throw new Error(`Agent @${agentKey} is not registered.`);
  }
  const resolved = existing ? resolveAgentExecutionConfig(existing) : null;

  await prisma.agent.update({
    where: { key: existing.key },
    data: {
      model: resolved?.model || undefined,
      host: WORKER_HOST,
      lastHeartbeatAt: new Date(),
      lastHeartbeatMeta: { pid: process.pid, pollMs: POLL_MS, ...leaseMeta }
    }
  });

  return existing.key;
}

async function ensureLeaseRow(tx = prisma) {
  return tx.orchestratorLease.upsert({
    where: { id: ORCHESTRATOR_LEASE_ID },
    create: { id: ORCHESTRATOR_LEASE_ID },
    update: {}
  });
}

async function lockLeaseRow(tx) {
  await tx.$queryRaw`SELECT "id" FROM "OrchestratorLease" WHERE "id" = ${ORCHESTRATOR_LEASE_ID} FOR UPDATE`;
  return tx.orchestratorLease.findUnique({
    where: { id: ORCHESTRATOR_LEASE_ID }
  });
}

async function writeLeaseAudit(tx, entry) {
  await tx.orchestratorLeaseAudit.create({
    data: {
      leaseId: ORCHESTRATOR_LEASE_ID,
      code: entry.code,
      message: entry.message,
      ownerId: entry.ownerId || null,
      previousOwnerId: entry.previousOwnerId || null,
      metadata: entry.metadata || undefined
    }
  });
}

function describeLeaseState(lease) {
  if (!lease?.ownerId) return "no active owner";
  return `${lease.ownerId} (expires ${isoOrNull(lease.expiresAt) || "unknown"})`;
}

async function acquireOrRenewOrchestratorLease(reason) {
  return prisma.$transaction(async (tx) => {
    await ensureLeaseRow(tx);
    const lease = await lockLeaseRow(tx);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ORCHESTRATOR_LEASE_TTL_MS);

    const hasOwner = Boolean(lease?.ownerId);
    const sameOwner = lease?.ownerId === ORCHESTRATOR_OWNER_ID;
    const expired = !lease?.expiresAt || lease.expiresAt.getTime() <= now.getTime();

    if (!hasOwner || sameOwner || expired) {
      const previousOwnerId = lease?.ownerId || null;
      const reclaimed = Boolean(hasOwner && !sameOwner && expired);
      const code = reclaimed
        ? "LEASE_RECLAIM_STALE"
        : hasOwner
        ? "LEASE_RENEWED"
        : "LEASE_ACQUIRED";
      const message = reclaimed
        ? `Stale orchestrator lease reclaimed by ${ORCHESTRATOR_OWNER_ID}. Previous owner ${previousOwnerId} expired at ${isoOrNull(
            lease?.expiresAt
          )}.`
        : sameOwner
        ? `Orchestrator lease renewed by ${ORCHESTRATOR_OWNER_ID}.`
        : `Orchestrator lease acquired by ${ORCHESTRATOR_OWNER_ID}.`;

      const updated = await tx.orchestratorLease.update({
        where: { id: ORCHESTRATOR_LEASE_ID },
        data: {
          ownerId: ORCHESTRATOR_OWNER_ID,
          ownerHost: WORKER_HOST,
          ownerPid: process.pid,
          ownerAgentKey: WORKER_AGENT_KEY || null,
          acquiredAt: sameOwner ? lease?.acquiredAt || now : now,
          lastHeartbeatAt: now,
          expiresAt,
          heartbeatCount: sameOwner
            ? { increment: 1 }
            : 1
        }
      });

      if (code !== "LEASE_RENEWED") {
        await writeLeaseAudit(tx, {
          code,
          message,
          ownerId: ORCHESTRATOR_OWNER_ID,
          previousOwnerId,
          metadata: {
            reason,
            ownerAgentKey: WORKER_AGENT_KEY || null,
            ownerHost: WORKER_HOST,
            ownerPid: process.pid,
            expiresAt: updated.expiresAt.toISOString()
          }
        });
      }

      return {
        held: true,
        code,
        lease: updated,
        reason
      };
    }

    return {
      held: false,
      code: "LEASE_HELD_BY_ACTIVE_OWNER",
      lease,
      reason,
      message: `Competing orchestrator writer rejected: lease held by ${describeLeaseState(
        lease
      )}.`
    };
  });
}

async function releaseOrchestratorLease(reason) {
  return prisma.$transaction(async (tx) => {
    await ensureLeaseRow(tx);
    const lease = await lockLeaseRow(tx);
    const now = new Date();
    if (!lease || lease.ownerId !== ORCHESTRATOR_OWNER_ID) {
      return { released: false, lease };
    }
    const updated = await tx.orchestratorLease.update({
      where: { id: ORCHESTRATOR_LEASE_ID },
      data: {
        ownerId: null,
        ownerHost: null,
        ownerPid: null,
        ownerAgentKey: null,
        expiresAt: now,
        lastHeartbeatAt: now
      }
    });
    await writeLeaseAudit(tx, {
      code: "LEASE_RELEASED",
      message: `Orchestrator lease released by ${ORCHESTRATOR_OWNER_ID}.`,
      ownerId: ORCHESTRATOR_OWNER_ID,
      metadata: {
        reason,
        ownerHost: WORKER_HOST,
        ownerPid: process.pid
      }
    });
    return { released: true, lease: updated };
  });
}

async function withLeaseAuthority(operation, mutation) {
  return prisma.$transaction(async (tx) => {
    await ensureLeaseRow(tx);
    const lease = await lockLeaseRow(tx);
    const now = new Date();
    const active = Boolean(
      lease?.ownerId === ORCHESTRATOR_OWNER_ID &&
        lease?.expiresAt &&
        lease.expiresAt.getTime() > now.getTime()
    );
    if (!active) {
      const message = `Blocked task lifecycle write (${operation}): lease held by ${describeLeaseState(
        lease
      )}.`;
      await writeLeaseAudit(tx, {
        code: "LEASE_WRITE_REJECTED",
        message,
        ownerId: ORCHESTRATOR_OWNER_ID,
        previousOwnerId: lease?.ownerId || null,
        metadata: {
          operation,
          ownerHost: WORKER_HOST,
          ownerPid: process.pid
        }
      });
      throw new WorkerTaskError("LEASE_NOT_HELD", message, true);
    }
    return mutation(tx);
  });
}

async function maintainOrchestratorLease(reason) {
  const outcome = await acquireOrRenewOrchestratorLease(reason);
  if (outcome.held) {
    const becameHolder = !leaseHeld;
    leaseHeld = true;
    if (becameHolder || outcome.code !== "LEASE_RENEWED") {
      console.log(
        `[warroom-worker] lease ${outcome.code.toLowerCase()} owner=${ORCHESTRATOR_OWNER_ID} ttlMs=${ORCHESTRATOR_LEASE_TTL_MS}`
      );
    }
    return true;
  }

  leaseHeld = false;
  const conflictKey = `${outcome?.lease?.ownerId || ""}:${isoOrNull(outcome?.lease?.expiresAt) || ""}`;
  const now = Date.now();
  if (
    conflictKey !== lastLeaseConflictKey ||
    now - lastLeaseConflictAt >= Math.max(POLL_MS * 5, 5000)
  ) {
    lastLeaseConflictKey = conflictKey;
    lastLeaseConflictAt = now;
    console.log(`[warroom-worker] ${outcome.message}`);
  }
  return false;
}

async function recoverStaleRunningTasks() {
  const cutoff = new Date(Date.now() - ORCHESTRATOR_STALE_RUNNING_MS);
  const result = await withLeaseAuthority("recover-stale-running", async (tx) => {
    const decision = evaluateOrchestratorTaskTransition(
      "RECOVER_STALE_RUNNING",
      "RUNNING",
      "QUEUED"
    );
    if (!decision.allowed) {
      await recordLifecycleAudit(
        {
          entityType: "TASK",
          actorRole: "ORCHESTRATOR",
          action: "RECOVER_STALE_RUNNING",
          fromState: "RUNNING",
          toState: "QUEUED",
          allowed: false,
          reason: decision.reason
        },
        tx
      );
      throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
    }

    const updated = await tx.agentTask.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: cutoff }
      },
      data: {
        status: "QUEUED",
        startedAt: null,
        error:
          "Recovered by orchestrator after stale running timeout (previous owner lost lease).",
        nextAttemptAt: new Date()
      }
    });
    if (updated.count > 0) {
      await recordLifecycleAudit(
        {
          entityType: "TASK",
          actorRole: "ORCHESTRATOR",
          action: "RECOVER_STALE_RUNNING",
          fromState: "RUNNING",
          toState: "QUEUED",
          allowed: true,
          reason: decision.reason,
          metadata: {
            count: updated.count,
            cutoff: cutoff.toISOString()
          }
        },
        tx
      );
      await recordAlphaFailureEvent(
        {
          failureClass: "STALE_RUNNING_DETECTED",
          issueNumber: null,
          leaseHealth: "STALE",
          metadata: {
            count: updated.count,
            cutoff: cutoff.toISOString(),
            staleRunningMs: ORCHESTRATOR_STALE_RUNNING_MS
          }
        },
        tx
      );
      await writeLeaseAudit(tx, {
        code: "STALE_RUNNING_TASKS_RECOVERED",
        message: `Recovered ${updated.count} stale RUNNING task(s) back to QUEUED.`,
        ownerId: ORCHESTRATOR_OWNER_ID,
        metadata: {
          cutoff: cutoff.toISOString(),
          staleRunningMs: ORCHESTRATOR_STALE_RUNNING_MS
        }
      });
    }
    return updated.count;
  });
  return result;
}

async function claimNextTask(agentKey) {
  return withLeaseAuthority("claim-next-task", async (tx) => {
    const now = new Date();
    const where = {
      status: "QUEUED",
      nextAttemptAt: { lte: now },
      ...(agentKey ? { agentKey } : {}),
      agent: {
        is: {
          enabled: true,
          readiness: "READY",
          runtime: { in: ["LOCAL", "CLOUD"] }
        }
      }
    };

    const next = await tx.agentTask.findFirst({
      where,
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      include: {
        agent: {
          select: { key: true, displayName: true, runtime: true, model: true, controlRole: true }
        }
      }
    });
    if (!next) return null;

    const claimed = await tx.agentTask.updateMany({
      where: { id: next.id, status: "QUEUED", nextAttemptAt: { lte: now } },
      data: { status: "RUNNING", startedAt: new Date() }
    });
    if (claimed.count !== 1) return null;

    const decision = evaluateOrchestratorTaskTransition(
      "CLAIM_TASK",
      next.status,
      "RUNNING"
    );
    if (!decision.allowed) {
      await recordLifecycleAudit(
        {
          entityType: "TASK",
          entityId: next.id,
          actorRole: "ORCHESTRATOR",
          action: "CLAIM_TASK",
          fromState: next.status,
          toState: "RUNNING",
          allowed: false,
          reason: decision.reason
        },
        tx
      );
      throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
    }

    await recordLifecycleAudit(
      {
        entityType: "TASK",
        entityId: next.id,
        actorRole: "ORCHESTRATOR",
        action: "CLAIM_TASK",
        fromState: next.status,
        toState: "RUNNING",
        allowed: true,
        reason: decision.reason
      },
      tx
    );

    return tx.agentTask.findUnique({
      where: { id: next.id },
      include: {
        agent: {
          select: { key: true, displayName: true, runtime: true, model: true, controlRole: true }
        }
      }
    });
  });
}

async function taskIntakeDecision(agentKey, db = prisma) {
  const agent = await db.agent.findUnique({
    where: { key: agentKey },
    select: { enabled: true, runtime: true, readiness: true }
  });
  if (!agent) {
    return {
      status: "MANUAL_REQUIRED",
      error: `Agent @${agentKey} is not registered in War Room.`
    };
  }
  if (!agent.enabled) {
    return {
      status: "MANUAL_REQUIRED",
      error: `Agent @${agentKey} is disabled.`
    };
  }
  if (agent.runtime === "MANUAL") {
    return {
      status: "MANUAL_REQUIRED",
      error: `Agent @${agentKey} uses MANUAL runtime and cannot execute automatically.`
    };
  }
  if (agent.readiness === "NOT_READY") {
    return {
      status: "MANUAL_REQUIRED",
      error: NOT_READY_REASON
    };
  }
  if (agent.readiness === "PAUSED") {
    return {
      status: "QUEUED",
      error: PAUSED_REASON
    };
  }
  return { status: "QUEUED", error: null };
}

async function postMessage(threadId, authorType, authorKey, content, meta, db = prisma) {
  if (!threadId) return;
  return db.chatMessage.create({
    data: {
      threadId,
      authorType,
      authorKey: authorKey || null,
      content,
      meta: meta || undefined
    }
  });
}

function parseAgentHandoffs(text) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("@")) continue;
    const m = /^@([A-Za-z0-9_-]+)\s+([\s\S]+)$/.exec(trimmed);
    if (!m) continue;
    out.push({
      target: m[1],
      command: m[2].trim(),
      rawMention: trimmed
    });
  }

  return out.filter((h) => h.command.length > 0);
}

async function resolveKnownAgentKey(rawAgentKey, db = prisma) {
  const wanted = normalizeLower(rawAgentKey);
  if (!wanted) return null;

  const local = await db.agent.findFirst({
    where: { key: { equals: wanted, mode: "insensitive" } },
    select: { key: true }
  });
  if (local?.key) return local.key;
  return null;
}

async function routeAgentHandoffs(params) {
  const db = params?.db || prisma;
  const sourceThreadId = params?.sourceThreadId || null;
  if (!sourceThreadId) return 0;

  const handoffs = parseAgentHandoffs(params.sourceContent);
  if (!handoffs.length) return 0;
  const requestedByRole = String(params?.requestedByRole || "BETA").toUpperCase();
  if (requestedByRole !== "ALPHA") {
    const denialReason =
      "Role boundary denied: only ALPHA agents can emit control handoff actions.";
    await recordLifecycleAudit(
      {
        entityType: "TASK",
        entityId: params?.sourceTaskId || null,
        actorRole: "WORKER",
        action: "BETA_CONTROL_DENIED",
        fromState: "RUNNING",
        toState: null,
        allowed: false,
        reason: denialReason,
        metadata: {
          requestedByAgent: params?.requestedByAgent || null,
          requestedByRole
        }
      },
      db
    );
    await postMessage(
      sourceThreadId,
      "SYSTEM",
      null,
      `${denialReason} Source=@${params?.requestedByAgent || "unknown"} (${requestedByRole}).`,
      {
        kind: "role_boundary_denied",
        requestedByAgent: params?.requestedByAgent || null,
        requestedByRole
      },
      db
    );
    return 0;
  }

  let routedCount = 0;

  for (const handoff of handoffs) {
    // eslint-disable-next-line no-await-in-loop
    const targetAgentKey = await resolveKnownAgentKey(handoff.target, db);
    if (!targetAgentKey) continue;

    if (normalizeLower(targetAgentKey) === normalizeLower(params.requestedByAgent)) {
      continue;
    }

    const trace = {
      requestedByAgent: params.requestedByAgent,
      sourceThreadId,
      sourceMessageId: params.sourceMessageId,
      handoffContext: {
        rawMention: handoff.rawMention,
        sourceTaskId: params.sourceTaskId,
        sourceTaskTitle: params.sourceTaskTitle
      }
    };

    // eslint-disable-next-line no-await-in-loop
    const intake = await taskIntakeDecision(targetAgentKey, db);
    const routeDecision = evaluateOrchestratorTaskTransition(
      "ROUTE_HANDOFF_TASK",
      null,
      intake.status
    );
    if (!routeDecision.allowed) {
      // eslint-disable-next-line no-await-in-loop
      await recordLifecycleAudit(
        {
          entityType: "TASK",
          actorRole: "ORCHESTRATOR",
          action: "ROUTE_HANDOFF_TASK",
          fromState: null,
          toState: intake.status,
          allowed: false,
          reason: routeDecision.reason,
          metadata: {
            targetAgentKey,
            requestedByAgent: params.requestedByAgent
          }
        },
        db
      );
      continue;
    }

    const routedTask = await db.agentTask.create({
      data: {
        agentKey: targetAgentKey,
        status: intake.status,
        issueNumber: params.issueNumber ?? null,
        threadId: sourceThreadId,
        title: handoff.command,
        error: intake.error,
        ...(intake.status === "MANUAL_REQUIRED" ? { finishedAt: new Date() } : {}),
        payload: {
          kind: "agent_handoff",
          command: handoff.command,
          ...trace
        }
      }
    });
    // eslint-disable-next-line no-await-in-loop
    await recordLifecycleAudit(
      {
        entityType: "TASK",
        entityId: routedTask.id,
        actorRole: "ORCHESTRATOR",
        action: "ROUTE_HANDOFF_TASK",
        fromState: null,
        toState: intake.status,
        allowed: true,
        reason: routeDecision.reason,
        metadata: {
          targetAgentKey,
          requestedByAgent: params.requestedByAgent
        }
      },
      db
    );

    // eslint-disable-next-line no-await-in-loop
    await postMessage(
      sourceThreadId,
      "SYSTEM",
      null,
      intake.status === "MANUAL_REQUIRED"
        ? `Handoff requires manual handling @${params.requestedByAgent} -> @${targetAgentKey}: ${intake.error}`
        : intake.error
        ? `Routed handoff queued @${params.requestedByAgent} -> @${targetAgentKey}: ${intake.error}`
        : `Routed handoff @${params.requestedByAgent} -> @${targetAgentKey}: ${handoff.command}`,
      {
        kind:
          intake.status === "MANUAL_REQUIRED"
            ? "agent_handoff_manual_required"
            : "agent_handoff_routed",
        taskId: routedTask.id,
        targetAgentKey,
        reason: intake.error,
        ...trace
      },
      db
    );

    routedCount += 1;
  }

  return routedCount;
}

function shortError(e) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String(e);
}

function trimText(value, maxLen) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function httpFailure(provider, status, responseBody) {
  const base = `${provider} HTTP ${status}`;
  const suffix = responseBody ? `: ${trimText(responseBody, 600)}` : "";
  if (status === 401 || status === 403) {
    return new WorkerTaskError("AUTH_REJECTED", `${base}${suffix}`, false);
  }
  if (status === 429) {
    return new WorkerTaskError("RATE_LIMITED", `${base}${suffix}`, true);
  }
  if (status === 408 || status === 504) {
    return new WorkerTaskError("PROVIDER_TIMEOUT", `${base}${suffix}`, true);
  }
  if (status >= 500) {
    return new WorkerTaskError("PROVIDER_UNAVAILABLE", `${base}${suffix}`, true);
  }
  return new WorkerTaskError("PROVIDER_BAD_REQUEST", `${base}${suffix}`, false);
}

function normalizeFailure(e) {
  if (e instanceof WorkerTaskError) {
    return {
      code: e.code || "EXECUTION_ERROR",
      retryable: Boolean(e.retryable),
      kind: e.retryable ? "RETRYABLE" : "NON_RETRYABLE",
      message: shortError(e)
    };
  }

  const message = shortError(e);
  if (/timed?\s*out|timeout/i.test(message)) {
    return {
      code: "PROVIDER_TIMEOUT",
      retryable: true,
      kind: "RETRYABLE",
      message
    };
  }
  if (/fetch failed|econnrefused|enotfound|network/i.test(message)) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
      kind: "RETRYABLE",
      message
    };
  }
  return {
    code: "EXECUTION_ERROR",
    retryable: true,
    kind: "RETRYABLE",
    message
  };
}

async function fetchWithTimeout(url, init, provider, timeoutOverrideMs) {
  const timeoutMs = clampInt(timeoutOverrideMs ?? REQUEST_TIMEOUT_MS, 60000, 1000, 300000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new WorkerTaskError(
        "PROVIDER_TIMEOUT",
        `${provider} request timed out after ${timeoutMs}ms`,
        true
      );
    }
    throw new WorkerTaskError(
      "PROVIDER_UNAVAILABLE",
      `${provider} request failed: ${shortError(e)}`,
      true
    );
  } finally {
    clearTimeout(timer);
  }
}

async function ghGraphQL(query, variables) {
  if (!GITHUB_TOKEN) {
    throw new Error("Missing WARROOM_GITHUB_TOKEN for board grounding.");
  }
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    throw new Error(`GitHub GraphQL HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
  }
  return json.data;
}

async function getProjectMeta() {
  if (cachedProjectMeta) return cachedProjectMeta;
  const data = await ghGraphQL(
    `query($owner:String!, $num:Int!) {
      user(login:$owner) {
        projectV2(number:$num) {
          id
          title
          fields(first:50) {
            nodes {
              __typename
              ... on ProjectV2SingleSelectField { id name options { id name } }
            }
          }
        }
      }
    }`,
    { owner: GITHUB_PROJECT_OWNER, num: GITHUB_PROJECT_NUMBER }
  );
  const project = data?.user?.projectV2;
  if (!project?.id) throw new Error("Unable to load project metadata.");
  cachedProjectMeta = project;
  return cachedProjectMeta;
}

function detectProduct(prompt, productOptions) {
  const lower = (prompt || "").toLowerCase();
  const found = productOptions.find((p) => lower.includes(p.toLowerCase()));
  return found || null;
}

async function listProjectItemsForProduct(product, limit = 200) {
  const meta = await getProjectMeta();
  const items = [];
  let after = null;

  while (items.length < limit) {
    const data = await ghGraphQL(
      `query($projectId:ID!, $after:String) {
        node(id:$projectId) {
          ... on ProjectV2 {
            items(first:50, after:$after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                content {
                  __typename
                  ... on Issue { number title url }
                }
                fieldValues(first:30) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { projectId: meta.id, after }
    );

    const batch = data?.node?.items?.nodes || [];
    for (const node of batch) {
      if (!node?.content || node.content.__typename !== "Issue") continue;
      const fields = {};
      for (const fv of node.fieldValues?.nodes || []) {
        if (
          fv?.__typename === "ProjectV2ItemFieldSingleSelectValue" &&
          fv.field?.name &&
          fv.name
        ) {
          fields[fv.field.name] = fv.name;
        }
      }
      if (fields.Product !== product) continue;
      items.push({
        number: node.content.number,
        title: node.content.title,
        url: node.content.url,
        fields
      });
      if (items.length >= limit) break;
    }

    const pageInfo = data?.node?.items?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) break;
    after = pageInfo.endCursor;
  }

  return items;
}

function countBy(items, field) {
  const out = {};
  for (const it of items) {
    const key = it.fields?.[field] || "(unset)";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function topEntries(mapObj, n = 3) {
  return Object.entries(mapObj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function formatThreeLineStatus(grounding) {
  const status = topEntries(grounding.statusCounts, 4)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  const priority = topEntries(grounding.priorityCounts, 3)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  const owners = topEntries(grounding.agentCounts, 3)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  return [
    `${grounding.product}: ${grounding.total} tasks total. Status => ${status || "n/a"}.`,
    `Priority mix => ${priority || "n/a"}.`,
    `Top owners => ${owners || "n/a"}.`
  ].join("\n");
}

async function maybeBuildBoardGrounding(prompt) {
  try {
    const meta = await getProjectMeta();
    const productField = (meta.fields?.nodes || []).find(
      (f) => f.__typename === "ProjectV2SingleSelectField" && f.name === "Product"
    );
    const productOptions = (productField?.options || []).map((o) => o.name);
    if (!productOptions.length) return null;

    const product = detectProduct(prompt, productOptions);
    if (!product) return null;

    const items = await listProjectItemsForProduct(product, 200);
    return {
      product,
      total: items.length,
      statusCounts: countBy(items, "Status"),
      priorityCounts: countBy(items, "Priority"),
      agentCounts: countBy(items, "Agent"),
      sampleTitles: items.slice(0, 5).map((i) => `#${i.number} ${i.title}`)
    };
  } catch (e) {
    // Grounding is best-effort. Worker should continue even if GitHub fetch fails.
    return null;
  }
}

function buildGroundingBlock(grounding) {
  return grounding
    ? `\n\nGrounding data from live board:\n${JSON.stringify(
        {
          product: grounding.product,
          total: grounding.total,
          statusCounts: grounding.statusCounts,
          priorityCounts: grounding.priorityCounts,
          agentCounts: grounding.agentCounts,
          sampleTitles: grounding.sampleTitles
        },
        null,
        2
      )}`
    : "";
}

async function runLocalRuntime(task, config, promptOverride = null) {
  if (!config.model) {
    throw new WorkerTaskError("CONFIG_MISSING", `No model configured for @${task.agentKey}.`, false);
  }
  const userPrompt = normalizeText(promptOverride) || task.title;
  const grounding = await maybeBuildBoardGrounding(userPrompt);

  if (grounding && /status/i.test(userPrompt) && /3[- ]?line/i.test(userPrompt)) {
    return {
      answer: formatThreeLineStatus(grounding),
      meta: {
        provider: "grounded-summary",
        source: "github-project-v2",
        product: grounding.product,
        total: grounding.total
      }
    };
  }

  const startedAt = Date.now();
  const groundingBlock = buildGroundingBlock(grounding);

  const res = await fetchWithTimeout(
    `${config.endpoint}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              `You are ${config.displayName}, a pragmatic coding agent in MVP Factory War Room. Reply with concise, actionable output. If grounding data is provided, use only that data for status claims and explicitly avoid guessing.`
          },
          { role: "user", content: `${userPrompt}${groundingBlock}` }
        ]
      })
    },
    "Ollama",
    config.requestTimeoutMs
  );

  if (!res.ok) {
    const txt = await res.text();
    throw httpFailure("Ollama", res.status, txt);
  }

  const data = await res.json();
  const content = data?.message?.content || data?.response || "";
  const answer = String(content || "").trim();
  if (!answer) {
    throw new WorkerTaskError("EMPTY_RESPONSE", "Ollama returned empty response.", false);
  }

  return {
    answer,
    meta: {
      provider: config.provider,
      baseUrl: config.endpoint,
      model: config.model,
      grounded: Boolean(grounding),
      product: grounding?.product || null,
      durationMs: Date.now() - startedAt,
      doneReason: data?.done_reason || null,
      evalCount: data?.eval_count || null,
      promptEvalCount: data?.prompt_eval_count || null,
      runtimeConfigDigest: config.runtimeConfigDigest || null
    }
  };
}

async function runCloudRuntime(task, config, promptOverride = null) {
  if (!config.apiKey) {
    throw new WorkerTaskError(
      "AUTH_MISSING",
      `API key missing for @${task.agentKey}. Set env ${config.apiKeyEnv}.`,
      false
    );
  }
  if (!config.model) {
    throw new WorkerTaskError("CONFIG_MISSING", `No model configured for @${task.agentKey}.`, false);
  }
  const userPrompt = normalizeText(promptOverride) || task.title;
  const grounding = await maybeBuildBoardGrounding(userPrompt);

  if (grounding && /status/i.test(userPrompt) && /3[- ]?line/i.test(userPrompt)) {
    return {
      answer: formatThreeLineStatus(grounding),
      meta: {
        provider: "grounded-summary",
        source: "github-project-v2",
        product: grounding.product,
        total: grounding.total,
        model: config.model
      }
    };
  }

  const groundingBlock = buildGroundingBlock(grounding);

  const startedAt = Date.now();
  const res = await fetchWithTimeout(
    `${config.endpoint}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              `You are ${config.displayName}, a pragmatic operations agent in MVP Factory War Room. Be concise and actionable. If grounding data is provided, use only that data for status claims and do not guess.`
          },
          { role: "user", content: `${userPrompt}${groundingBlock}` }
        ]
      })
    },
    "OpenAI-compatible",
    config.requestTimeoutMs
  );

  if (!res.ok) {
    const txt = await res.text();
    throw httpFailure("OpenAI-compatible", res.status, txt);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  const answer =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw)
      ? raw
          .map((p) => (typeof p?.text === "string" ? p.text : ""))
          .join("")
          .trim()
      : "";
  if (!answer) {
    throw new WorkerTaskError("EMPTY_RESPONSE", "OpenAI returned empty response.", false);
  }

  return {
    answer,
    meta: {
      provider: config.provider,
      baseUrl: config.endpoint,
      model: config.model,
      grounded: Boolean(grounding),
      product: grounding?.product || null,
      durationMs: Date.now() - startedAt,
      promptTokens: data?.usage?.prompt_tokens || null,
      completionTokens: data?.usage?.completion_tokens || null,
      totalTokens: data?.usage?.total_tokens || null,
      runtimeConfigDigest: config.runtimeConfigDigest || null
    }
  };
}

function readToolPromptFromCallArgs(call) {
  const args = asRecord(call?.args);
  if (!args) return "";
  const prompt = normalizeText(args.prompt);
  if (prompt) return prompt;
  const command = normalizeText(args.command);
  if (command) return command;
  const input = normalizeText(args.input);
  if (input) return input;
  return "";
}

async function executeToolCallProtocol(task, config, envelope, policyEvaluation, dryRun) {
  const responses = [];
  const callMeta = [];
  const policyByCallId = new Map(
    (policyEvaluation.decisions || []).map((decision) => [decision.callId, decision])
  );

  for (let index = 0; index < envelope.calls.length; index += 1) {
    const call = envelope.calls[index];
    const callPrefix = `tool-call ${call.id} (${call.tool})`;
    const policyDecision = policyByCallId.get(call.id) || null;
    if (!policyDecision || !policyDecision.allowed) {
      const reason =
        policyDecision?.reason || `${callPrefix} denied: no allow policy decision is available.`;
      await recordLifecycleAudit({
        entityType: "TASK",
        entityId: task.id,
        actorRole: "ORCHESTRATOR",
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        fromState: task.status,
        toState: task.status,
        allowed: true,
        reason,
        metadata: {
          callId: call.id,
          tool: call.tool,
          riskClass: call.riskClass,
          approval: call.approval
        }
      });
      throw new WorkerTaskError("TOOL_CALL_POLICY_DENIED", reason, false);
    }

    if (dryRun) {
      const reason = `${callPrefix} dry-run accepted: execution skipped by policy flag.`;
      await recordLifecycleAudit({
        entityType: "TASK",
        entityId: task.id,
        actorRole: "ORCHESTRATOR",
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        fromState: task.status,
        toState: task.status,
        allowed: false,
        reason,
        metadata: {
          callId: call.id,
          tool: call.tool,
          riskClass: call.riskClass,
          approval: call.approval,
          policyClass: policyDecision.policyClass,
          dryRun: true
        }
      });
      responses.push(
        `[dry-run ${call.id}] ${call.tool} blocked from execution; policy class=${policyDecision.policyClass}.`
      );
      callMeta.push({
        id: call.id,
        tool: call.tool,
        dryRun: true,
        policyClass: policyDecision.policyClass
      });
      continue;
    }

    if (call.tool !== "chat.respond") {
      const reason = `${callPrefix} denied: runtime handler is not enabled for this tool in current phase.`;
      await recordLifecycleAudit({
        entityType: "TASK",
        entityId: task.id,
        actorRole: "ORCHESTRATOR",
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        fromState: task.status,
        toState: task.status,
        allowed: false,
        reason,
        metadata: {
          callId: call.id,
          tool: call.tool,
          riskClass: call.riskClass,
          approval: call.approval,
          policyClass: policyDecision.policyClass
        }
      });
      throw new WorkerTaskError("TOOL_CALL_UNSUPPORTED", reason, false);
    }

    const prompt = readToolPromptFromCallArgs(call);
    if (!prompt) {
      const reason =
        `${callPrefix} denied: args.prompt (or args.command/args.input) is required for chat.respond.`;
      await recordLifecycleAudit({
        entityType: "TASK",
        entityId: task.id,
        actorRole: "ORCHESTRATOR",
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        fromState: task.status,
        toState: task.status,
        allowed: false,
        reason,
        metadata: {
          callId: call.id,
          tool: call.tool,
          riskClass: call.riskClass,
          approval: call.approval,
          policyClass: policyDecision.policyClass
        }
      });
      throw new WorkerTaskError("TOOL_CALL_INVALID_ARGS", reason, false);
    }

    const runtimeResult =
      task.agent.runtime === "LOCAL"
        ? await runLocalRuntime(task, config, prompt)
        : await runCloudRuntime(task, config, prompt);

    await recordLifecycleAudit({
      entityType: "TASK",
      entityId: task.id,
      actorRole: "ORCHESTRATOR",
      action: "TOOL_CALL_PROTOCOL_EXECUTE",
      fromState: task.status,
      toState: task.status,
      allowed: true,
      reason: `${callPrefix} executed.`,
      metadata: {
        callId: call.id,
        tool: call.tool,
        riskClass: call.riskClass,
        approval: call.approval,
        policyClass: policyDecision.policyClass,
        dryRun: false
      }
    });

    responses.push(envelope.calls.length === 1 ? runtimeResult.answer : `[${call.id}] ${runtimeResult.answer}`);
    callMeta.push({
      id: call.id,
      tool: call.tool,
      provider: runtimeResult.meta?.provider || null
    });
  }

  return {
    answer: responses.join("\n\n"),
    meta: {
      provider: config.provider,
      model: config.model,
      toolCallProtocol: true,
      toolCallProtocolVersion: envelope.version,
      toolCallCount: envelope.calls.length,
      toolCalls: callMeta,
      runtimeConfigDigest: config.runtimeConfigDigest || null
    }
  };
}

async function executeTask(task) {
  const agent = task?.agent;
  if (!agent) {
    throw new WorkerTaskError(
      "CONFIG_MISSING",
      `Task ${task?.id || "(unknown)"} is missing agent relation.`,
      false
    );
  }
  const runtimeResolution = readTaskRuntimeConfigResolution(task?.payload);
  if (runtimeResolution) {
    await recordLifecycleAudit({
      entityType: "TASK",
      entityId: task.id,
      actorRole: "ORCHESTRATOR",
      action: "RUNTIME_CONFIG_RESOLUTION",
      fromState: task.status,
      toState: task.status,
      allowed: true,
      reason: "Runtime config resolution applied for execution.",
      metadata: {
        digest: runtimeResolution.digest,
        projectKey: runtimeResolution.projectKey,
        projectName: runtimeResolution.projectName,
        activeContextWindowId: runtimeResolution.activeContextWindowId,
        activeContextOwnerAgentKey: runtimeResolution.activeContextOwnerAgentKey,
        sourceChain: runtimeResolution.sourceChain
      }
    });
  }
  const config = resolveAgentExecutionConfig(agent, runtimeResolution);
  const payloadRecord = asRecord(task?.payload);
  const toolCallPolicyInput = readTaskToolCallPolicy(payloadRecord);
  const toolCallProtocolValidation = validateToolCallProtocolEnvelope(
    payloadRecord?.toolCallProtocol
  );
  if (toolCallProtocolValidation.present) {
    await recordLifecycleAudit({
      entityType: "TASK",
      entityId: task.id,
      actorRole: "ORCHESTRATOR",
      action: "TOOL_CALL_PROTOCOL_CONSUME",
      fromState: task.status,
      toState: task.status,
      allowed: toolCallProtocolValidation.ok,
      reason: toolCallProtocolValidation.reason,
      metadata: toolCallProtocolValidation.ok
        ? summarizeToolCallProtocolEnvelope(toolCallProtocolValidation.envelope)
        : { code: toolCallProtocolValidation.code }
    });
    if (!toolCallProtocolValidation.ok) {
      throw new WorkerTaskError("TOOL_CALL_INVALID", toolCallProtocolValidation.reason, false);
    }

    const policyEvaluation = evaluateToolCommandPolicy(toolCallProtocolValidation.envelope);
    await recordLifecycleAudit({
      entityType: "TASK",
      entityId: task.id,
      actorRole: "ORCHESTRATOR",
      action: "TOOL_COMMAND_POLICY_EVALUATE",
      fromState: task.status,
      toState: task.status,
      allowed: policyEvaluation.allowed,
      reason:
        policyEvaluation.denyReason ||
        policyEvaluation.approvalReason ||
        "Tool command policy evaluation passed.",
      metadata: {
        approvalTokenPresent: Boolean(readTaskToolCallApprovalToken(payloadRecord)),
        dryRun: toolCallPolicyInput.dryRun,
        ...summarizeToolCommandPolicyEvaluation(policyEvaluation)
      }
    });

    if (!policyEvaluation.allowed) {
      throw new WorkerTaskError(
        "TOOL_CALL_POLICY_DENIED",
        policyEvaluation.denyReason || "Tool command policy denied the action.",
        false
      );
    }

    await verifyAndConsumeToolCallApproval({
      task,
      envelope: toolCallProtocolValidation.envelope,
      policyEvaluation,
      payload: payloadRecord
    });

    return executeToolCallProtocol(
      task,
      config,
      toolCallProtocolValidation.envelope,
      policyEvaluation,
      toolCallPolicyInput.dryRun
    );
  }

  if (agent.runtime === "LOCAL") {
    return runLocalRuntime(task, config);
  }
  if (agent.runtime === "CLOUD") {
    return runCloudRuntime(task, config);
  }
  throw new WorkerTaskError(
    "CONFIG_MISSING",
    `No runtime executor configured for runtime "${agent.runtime}".`,
    false
  );
}

async function processTask(task) {
  const agentKey = task.agentKey;
  const title = task.title;
  const { maxAttempts, attemptCount } = normalizeTaskLimits(task);

  await postMessage(
    task.threadId,
    "AGENT",
    agentKey,
    `Ack. Working on: ${title}`,
    { kind: "worker_ack", taskId: task.id }
  );

  try {
    const result = await executeTask(task);

    await withLeaseAuthority(`complete-task:${task.id}`, async (tx) => {
      const current = await tx.agentTask.findUnique({
        where: { id: task.id },
        select: { status: true }
      });
      if (!current) {
        throw new WorkerTaskError(
          "TRANSITION_DENIED",
          `Completion denied: task ${task.id} not found.`,
          false
        );
      }
      const decision = evaluateOrchestratorTaskTransition(
        "COMPLETE_TASK",
        current.status,
        "DONE"
      );
      if (!decision.allowed) {
        await recordLifecycleAudit(
          {
            entityType: "TASK",
            entityId: task.id,
            actorRole: "ORCHESTRATOR",
            action: "COMPLETE_TASK",
            fromState: current.status,
            toState: "DONE",
            allowed: false,
            reason: decision.reason
          },
          tx
        );
        throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
      }

      const doneMessage = await postMessage(task.threadId, "AGENT", agentKey, result.answer, {
        kind: "worker_done",
        taskId: task.id,
        ...result.meta
      }, tx);

      await routeAgentHandoffs({
        requestedByAgent: agentKey,
        requestedByRole: task.agent?.controlRole || "BETA",
        sourceThreadId: task.threadId,
        sourceMessageId: doneMessage?.id || null,
        sourceContent: result.answer,
        sourceTaskId: task.id,
        sourceTaskTitle: task.title,
        issueNumber: task.issueNumber,
        db: tx
      });

      await tx.agentTask.update({
        where: { id: task.id },
        data: {
          status: "DONE",
          finishedAt: new Date(),
          error: null,
          lastFailureCode: null,
          lastFailureKind: null,
          deadLetteredAt: null,
          nextAttemptAt: new Date()
        }
      });
      await recordLifecycleAudit(
        {
          entityType: "TASK",
          entityId: task.id,
          actorRole: "ORCHESTRATOR",
          action: "COMPLETE_TASK",
          fromState: current.status,
          toState: "DONE",
          allowed: true,
          reason: decision.reason
        },
        tx
      );
    });
  } catch (e) {
    const failure = normalizeFailure(e);
    if (failure.code === "LEASE_NOT_HELD" || failure.code === "TRANSITION_DENIED") {
      console.warn(
        `[warroom-worker] skipped task completion mutation for ${task.id}: ${failure.message}`
      );
      return;
    }
    const nextAttemptCount = attemptCount + 1;
    const canRetry = failure.retryable && nextAttemptCount < maxAttempts;
    if (canRetry) {
      const delayMs = computeRetryDelayMs(nextAttemptCount);
      const nextAttemptAt = new Date(Date.now() + delayMs);
      await withLeaseAuthority(`retry-task:${task.id}`, async (tx) => {
        const current = await tx.agentTask.findUnique({
          where: { id: task.id },
          select: { status: true }
        });
        if (!current) {
          throw new WorkerTaskError(
            "TRANSITION_DENIED",
            `Retry denied: task ${task.id} not found.`,
            false
          );
        }
        const decision = evaluateOrchestratorTaskTransition(
          "RETRY_TASK",
          current.status,
          "QUEUED"
        );
        if (!decision.allowed) {
          await recordLifecycleAudit(
            {
              entityType: "TASK",
              entityId: task.id,
              actorRole: "ORCHESTRATOR",
              action: "RETRY_TASK",
              fromState: current.status,
              toState: "QUEUED",
              allowed: false,
              reason: decision.reason
            },
            tx
          );
          throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
        }

        await postMessage(
          task.threadId,
          "SYSTEM",
          null,
          `Task failed for @${agentKey}: ${failure.message} (code=${failure.code}). Retry ${nextAttemptCount}/${maxAttempts} in ${Math.ceil(delayMs / 1000)}s.`,
          {
            kind: "worker_retry_scheduled",
            taskId: task.id,
            error: failure.message,
            ...failureMeta(failure, nextAttemptCount, maxAttempts),
            nextAttemptAt: nextAttemptAt.toISOString()
          },
          tx
        );
        await tx.agentTask.update({
          where: { id: task.id },
          data: {
            status: "QUEUED",
            attemptCount: nextAttemptCount,
            error: formatFailureMessage(failure),
            lastFailureCode: failure.code,
            lastFailureKind: failure.kind,
            nextAttemptAt,
            finishedAt: null
          }
        });
        await recordLifecycleAudit(
          {
            entityType: "TASK",
            entityId: task.id,
            actorRole: "ORCHESTRATOR",
            action: "RETRY_TASK",
            fromState: current.status,
            toState: "QUEUED",
            allowed: true,
            reason: decision.reason
          },
          tx
        );
      });
      return;
    }

    await withLeaseAuthority(`dead-letter-task:${task.id}`, async (tx) => {
      const current = await tx.agentTask.findUnique({
        where: { id: task.id },
        select: { status: true }
      });
      if (!current) {
        throw new WorkerTaskError(
          "TRANSITION_DENIED",
          `Dead-letter denied: task ${task.id} not found.`,
          false
        );
      }
      const decision = evaluateOrchestratorTaskTransition(
        "DEAD_LETTER_TASK",
        current.status,
        "DEAD_LETTER"
      );
      if (!decision.allowed) {
        await recordLifecycleAudit(
          {
            entityType: "TASK",
            entityId: task.id,
            actorRole: "ORCHESTRATOR",
            action: "DEAD_LETTER_TASK",
            fromState: current.status,
            toState: "DEAD_LETTER",
            allowed: false,
            reason: decision.reason
          },
          tx
        );
        throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
      }

      await postMessage(
        task.threadId,
        "SYSTEM",
        null,
        `Task moved to dead-letter for @${agentKey}: ${failure.message} (code=${failure.code}, attempts=${nextAttemptCount}/${maxAttempts}).`,
        {
          kind: "worker_dead_letter",
          taskId: task.id,
          error: failure.message,
          ...failureMeta(failure, nextAttemptCount, maxAttempts)
        },
        tx
      );
      await tx.agentTask.update({
        where: { id: task.id },
        data: {
          status: "DEAD_LETTER",
          attemptCount: nextAttemptCount,
          finishedAt: new Date(),
          deadLetteredAt: new Date(),
          error: formatFailureMessage(failure),
          lastFailureCode: failure.code,
          lastFailureKind: failure.kind
        }
      });
      await recordLifecycleAudit(
        {
          entityType: "TASK",
          entityId: task.id,
          actorRole: "ORCHESTRATOR",
          action: "DEAD_LETTER_TASK",
          fromState: current.status,
          toState: "DEAD_LETTER",
          allowed: true,
          reason: decision.reason
        },
        tx
      );
      await recordAlphaFailureEvent(
        {
          failureClass: "EXECUTION_RETRY_EXHAUSTED",
          issueNumber: task.issueNumber ?? null,
          taskId: task.id,
          threadId: task.threadId || null,
          metadata: {
            agentKey,
            code: failure.code,
            attempts: {
              current: nextAttemptCount,
              max: maxAttempts
            }
          }
        },
        tx
      );
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[warroom-worker] received ${signal}; draining loop and releasing lease.`);
}

process.on("SIGINT", () => requestShutdown("SIGINT"));
process.on("SIGTERM", () => requestShutdown("SIGTERM"));

async function loop() {
  if (!RAW_AGENT_KEY) {
    throw new Error(
      "WARROOM_WORKER_AGENT_KEY is required for control-plane worker startup and must reference an ALPHA agent."
    );
  }
  WORKER_AGENT_KEY = await resolveCanonicalAgentKey(RAW_AGENT_KEY);
  const roleRow = await prisma.agent.findUnique({
    where: { key: WORKER_AGENT_KEY },
    select: { controlRole: true }
  });
  WORKER_CONTROL_ROLE = roleRow?.controlRole || null;
  if (WORKER_CONTROL_ROLE !== "ALPHA") {
    throw new Error(
      `Agent @${WORKER_AGENT_KEY} role is ${WORKER_CONTROL_ROLE || "unknown"}. Only ALPHA can run orchestrator worker.`
    );
  }
  CLAIM_ALL_TASKS = true;

  await ensureLeaseRow();
  console.log(
    `[warroom-worker] started. agent=${WORKER_AGENT_KEY || "ANY"} role=${WORKER_CONTROL_ROLE || "UNSCOPED"} claimScope=${CLAIM_ALL_TASKS ? "ALL" : "FILTERED"} poll=${POLL_MS}ms owner=${ORCHESTRATOR_OWNER_ID} lease=${ORCHESTRATOR_LEASE_ID}`
  );
  let lastRecoveryMs = 0;
  for (; !isShuttingDown;) {
    try {
      const held = await maintainOrchestratorLease("loop-tick");
      await heartbeat(WORKER_AGENT_KEY, {
        leaseId: ORCHESTRATOR_LEASE_ID,
        leaseOwnerId: held ? ORCHESTRATOR_OWNER_ID : null,
        leaseHeld: held
      });

      if (!held) {
        await sleep(POLL_MS);
        continue;
      }

      const nowMs = Date.now();
      if (nowMs - lastRecoveryMs >= Math.max(ORCHESTRATOR_STALE_RUNNING_MS, 5000)) {
        const recovered = await recoverStaleRunningTasks();
        if (recovered > 0) {
          console.log(`[warroom-worker] recovered ${recovered} stale running task(s).`);
        }
        lastRecoveryMs = nowMs;
      }

      const task = await claimNextTask(CLAIM_ALL_TASKS ? null : WORKER_AGENT_KEY);
      if (!task) {
        await sleep(POLL_MS);
        continue;
      }
      console.log(`[warroom-worker] claimed ${task.id} agent=${task.agentKey}`);

      const renewIntervalMs = Math.max(Math.floor(ORCHESTRATOR_LEASE_TTL_MS / 3), 1000);
      const renewTimer = setInterval(() => {
        if (isShuttingDown) return;
        void maintainOrchestratorLease("task-heartbeat").catch((err) => {
          console.error("[warroom-worker] lease heartbeat failed", err);
        });
      }, renewIntervalMs);

      try {
        await processTask(task);
      } finally {
        clearInterval(renewTimer);
      }
    } catch (e) {
      console.error("[warroom-worker] error", e);
      await sleep(POLL_MS);
    }
  }
}

loop()
  .catch((e) => {
    console.error("[warroom-worker] fatal", e);
  })
  .finally(async () => {
    try {
      await releaseOrchestratorLease("worker-exit");
    } catch (e) {
      console.error("[warroom-worker] release failed", e);
    }
    await prisma.$disconnect();
  });
