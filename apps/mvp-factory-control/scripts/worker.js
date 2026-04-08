/* eslint-disable no-console */
/**
 * Node worker: claims tasks from Prisma, runs tool-call envelopes (filesystem, git, shell) with policy + approval tokens,
 * updates task state and orchestrator lease heartbeats. Loads `.env` from app root. Mirrors TS modules under `scripts/lib/`.
 * Spawned by `worker-process.ts` / agents UI; long-running process per agent/runtime.
 */
//> Variable declaration.
const { PrismaClient } = require("@prisma/client");
//> Variable declaration.
const fs = require("node:fs");
//> Variable declaration.
const os = require("node:os");
//> Variable declaration.
const path = require("node:path");
//> Source statement or expression.
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
//> Variable declaration.
const {
  //> Source statement or expression.
  summarizeToolCallProtocolEnvelope,
  //> Source statement or expression.
  validateToolCallProtocolEnvelope
//> Source statement or expression.
} = require("./lib/tool-call-protocol");
//> Variable declaration.
const {
  //> Source statement or expression.
  buildToolCallActionFingerprint,
  //> Source statement or expression.
  verifyToolCallApprovalToken
//> Source statement or expression.
} = require("./lib/tool-call-approval");
//> Variable declaration.
const {
  //> Source statement or expression.
  evaluateToolCommandPolicy,
  //> Source statement or expression.
  summarizeToolCommandPolicyEvaluation
//> Source statement or expression.
} = require("./lib/tool-command-policy");
//> Variable declaration.
const {
  //> Source statement or expression.
  ToolFilesystemError,
  //> Source statement or expression.
  executeFilesystemToolCall,
  //> Source statement or expression.
  resolveFilesystemToolContext
//> Source statement or expression.
} = require("./lib/tool-filesystem");
//> Variable declaration.
const {
  //> Source statement or expression.
  ToolGitError,
  //> Source statement or expression.
  executeGitToolCall,
  //> Source statement or expression.
  resolveGitToolContext
//> Source statement or expression.
} = require("./lib/tool-git");
//> Variable declaration.
const {
  //> Source statement or expression.
  ToolShellError,
  //> Source statement or expression.
  executeShellToolCall,
  //> Source statement or expression.
  resolveShellToolContext
//> Source statement or expression.
} = require("./lib/tool-shell");

//> Variable declaration.
const prisma = new PrismaClient();

//> Function declaration.
function argValue(prefix) {
  //> Variable declaration.
  const found = process.argv.find((a) => a.startsWith(`${prefix}=`));
  //> Conditional branch.
  if (!found) return null;
  //> Return a value.
  return found.slice(prefix.length + 1);
//> Brace or statement terminator.
}

//> Variable declaration.
const RAW_AGENT_KEY =
  //> Source statement or expression.
  argValue("--agent") || process.env.MVP_FACTORY_CONTROL_WORKER_AGENT_KEY || null;
//> Variable declaration.
const POLL_MS = Number(process.env.MVP_FACTORY_CONTROL_WORKER_POLL_MS || "1200");
//> Variable declaration.
const WORKER_MODEL = process.env.MVP_FACTORY_CONTROL_WORKER_MODEL || null;
//> Variable declaration.
const WORKER_HOST = process.env.MVP_FACTORY_CONTROL_WORKER_HOST || os.hostname();
//> Variable declaration.
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
//> Variable declaration.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:latest";
//> Variable declaration.
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
//> Variable declaration.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
//> Variable declaration.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
//> Variable declaration.
const GITHUB_TOKEN =
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_GITHUB_TOKEN ||
  //> Source statement or expression.
  process.env.GITHUB_TOKEN ||
  //> Source statement or expression.
  process.env.MVP_PROJECT_TOKEN ||
  //> Source statement or expression.
  null;
//> Variable declaration.
const GITHUB_PROJECT_OWNER =
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_GITHUB_PROJECT_OWNER || "moldovancsaba";
//> Variable declaration.
const GITHUB_REPO_OWNER =
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_GITHUB_REPO_OWNER || "moldovancsaba";
//> Variable declaration.
const GITHUB_REPO_NAME =
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_GITHUB_REPO_NAME || "mvp-factory-control";
//> Variable declaration.
const GITHUB_PROJECT_NUMBER = Number(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_GITHUB_PROJECT_NUMBER || "1"
//> Delimiter or separator.
);
//> Variable declaration.
const SETTINGS_FILE = path.join(__dirname, "..", ".mvp-factory-control", "settings.json");

//> Variable declaration.
let cachedProjectMeta = null;
//> Variable declaration.
let WORKER_AGENT_KEY = RAW_AGENT_KEY;
//> Variable declaration.
let WORKER_CONTROL_ROLE = null;
//> Variable declaration.
let CLAIM_ALL_TASKS = false;
//> Variable declaration.
const NOT_READY_REASON =
  //> String literal line.
  "Agent readiness is NOT_READY. Complete the readiness checklist and switch the agent to READY.";
//> Variable declaration.
const PAUSED_REASON =
  //> String literal line.
  "Agent readiness is PAUSED. Task is queued and will execute after switching back to READY.";
//> Variable declaration.
const DEFAULT_MAX_ATTEMPTS = Number(process.env.MVP_FACTORY_CONTROL_TASK_MAX_ATTEMPTS || "3");
//> Variable declaration.
const RETRY_BASE_MS = Number(process.env.MVP_FACTORY_CONTROL_TASK_RETRY_BASE_MS || "5000");
//> Variable declaration.
const RETRY_MAX_MS = Number(process.env.MVP_FACTORY_CONTROL_TASK_RETRY_MAX_MS || "300000");
//> Variable declaration.
const RETRY_JITTER_MS = Number(process.env.MVP_FACTORY_CONTROL_TASK_RETRY_JITTER_MS || "750");
//> Variable declaration.
const REQUEST_TIMEOUT_MS = Number(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_WORKER_REQUEST_TIMEOUT_MS || "60000"
//> Delimiter or separator.
);
//> Variable declaration.
const SHELL_STREAM_FLUSH_CHARS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_SHELL_STREAM_FLUSH_CHARS || "1200",
  //> Source statement or expression.
  1200,
  //> Source statement or expression.
  200,
  //> Source statement or expression.
  4000
//> Delimiter or separator.
);
//> Variable declaration.
const SHELL_STREAM_MESSAGE_MAX_CHARS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_SHELL_STREAM_MESSAGE_MAX_CHARS || "1600",
  //> Source statement or expression.
  1600,
  //> Source statement or expression.
  200,
  //> Source statement or expression.
  6000
//> Delimiter or separator.
);
//> Variable declaration.
const SHELL_ARTIFACT_SNIPPET_MAX_CHARS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_SHELL_ARTIFACT_SNIPPET_MAX_CHARS || "4000",
  //> Source statement or expression.
  4000,
  //> Source statement or expression.
  500,
  //> Source statement or expression.
  24000
//> Delimiter or separator.
);
//> Variable declaration.
const ISSUE_EVIDENCE_MAX_ATTEMPTS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_ISSUE_EVIDENCE_MAX_ATTEMPTS || "3",
  //> Source statement or expression.
  3,
  //> Source statement or expression.
  1,
  //> Source statement or expression.
  6
//> Delimiter or separator.
);
//> Variable declaration.
const ISSUE_EVIDENCE_RETRY_BASE_MS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_ISSUE_EVIDENCE_RETRY_BASE_MS || "1000",
  //> Source statement or expression.
  1000,
  //> Source statement or expression.
  250,
  //> Source statement or expression.
  60_000
//> Delimiter or separator.
);
//> Variable declaration.
const ISSUE_EVIDENCE_RETRY_MAX_MS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_ISSUE_EVIDENCE_RETRY_MAX_MS || "15000",
  //> Source statement or expression.
  15_000,
  //> Source statement or expression.
  ISSUE_EVIDENCE_RETRY_BASE_MS,
  //> Source statement or expression.
  300_000
//> Delimiter or separator.
);
//> Variable declaration.
const ORCHESTRATOR_LEASE_ID =
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_ORCHESTRATOR_LEASE_ID || "mvp-factory-control-primary-orchestrator";
//> Variable declaration.
const ORCHESTRATOR_LEASE_TTL_MS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_ORCHESTRATOR_LEASE_TTL_MS || "20000",
  //> Source statement or expression.
  20_000,
  //> Source statement or expression.
  5_000,
  //> Source statement or expression.
  300_000
//> Delimiter or separator.
);
//> Variable declaration.
const ORCHESTRATOR_STALE_RUNNING_MS = clampInt(
  //> Source statement or expression.
  process.env.MVP_FACTORY_CONTROL_ORCHESTRATOR_STALE_RUNNING_MS || String(Math.max(ORCHESTRATOR_LEASE_TTL_MS * 2, 30_000)),
  //> Source statement or expression.
  Math.max(ORCHESTRATOR_LEASE_TTL_MS * 2, 30_000),
  //> Source statement or expression.
  ORCHESTRATOR_LEASE_TTL_MS,
  //> Source statement or expression.
  3_600_000
//> Delimiter or separator.
);
//> Variable declaration.
const ORCHESTRATOR_OWNER_ID = [
  //> Source statement or expression.
  WORKER_HOST,
  //> Source statement or expression.
  process.pid,
  //> Source statement or expression.
  RAW_AGENT_KEY || "ANY",
  //> Source statement or expression.
  Date.now().toString(36)
//> Source statement or expression.
].join(":");

//> Source statement or expression.
class WorkerTaskError extends Error {
  //> Source statement or expression.
  constructor(code, message, retryable) {
    //> Source statement or expression.
    super(message);
    //> Source statement or expression.
    this.name = "WorkerTaskError";
    //> Source statement or expression.
    this.code = code;
    //> Source statement or expression.
    this.retryable = Boolean(retryable);
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function clampInt(input, fallback, min, max) {
  //> Variable declaration.
  const n = Number(input);
  //> Conditional branch.
  if (!Number.isFinite(n)) return fallback;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(n), min), max);
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeTaskLimits(task) {
  //> Variable declaration.
  const maxAttempts = clampInt(task?.maxAttempts, clampInt(DEFAULT_MAX_ATTEMPTS, 3, 1, 10), 1, 10);
  //> Variable declaration.
  const attemptCount = clampInt(task?.attemptCount, 0, 0, 1000);
  //> Return a value.
  return { maxAttempts, attemptCount };
//> Brace or statement terminator.
}

//> Function declaration.
function computeRetryDelayMs(attemptCount) {
  //> Variable declaration.
  const step = Math.max(attemptCount, 1) - 1;
  //> Variable declaration.
  const base = clampInt(RETRY_BASE_MS, 5000, 250, 60_000);
  //> Variable declaration.
  const max = clampInt(RETRY_MAX_MS, 300000, base, 3_600_000);
  //> Variable declaration.
  const jitter = clampInt(RETRY_JITTER_MS, 750, 0, 10_000);
  //> Variable declaration.
  const raw = Math.min(base * 2 ** step, max);
  //> Variable declaration.
  const variance = jitter ? Math.floor(Math.random() * (jitter + 1)) : 0;
  //> Return a value.
  return Math.min(raw + variance, max);
//> Brace or statement terminator.
}

//> Function declaration.
function formatFailureMessage(failure) {
  //> Return a value.
  return `[${failure.code}] ${failure.message}`;
//> Brace or statement terminator.
}

//> Function declaration.
function failureMeta(failure, attemptCount, maxAttempts) {
  //> Return a value.
  return {
    //> Source statement or expression.
    code: failure.code,
    //> Source statement or expression.
    retryable: failure.retryable,
    //> Source statement or expression.
    attemptCount,
    //> Source statement or expression.
    maxAttempts
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeLower(v) {
  //> Return a value.
  return String(v || "").trim().toLowerCase();
//> Brace or statement terminator.
}

//> Function declaration.
function asRecord(value) {
  //> Conditional branch.
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  //> Return a value.
  return value;
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeText(value) {
  //> Return a value.
  return String(value || "").trim();
//> Brace or statement terminator.
}

//> Variable declaration.
const SHELL_OUTPUT_REDACTION_RULES = [
  //> Brace or statement terminator.
  {
    //> Source statement or expression.
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
    //> Source statement or expression.
    replacement: "[REDACTED_GITHUB_TOKEN]"
  //> Brace or statement terminator.
  },
  //> Brace or statement terminator.
  {
    //> Source statement or expression.
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    //> Source statement or expression.
    replacement: "[REDACTED_GITHUB_TOKEN]"
  //> Brace or statement terminator.
  },
  //> Brace or statement terminator.
  {
    //> Source statement or expression.
    pattern: /\bsk-[A-Za-z0-9]{16,}\b/g,
    //> Source statement or expression.
    replacement: "[REDACTED_API_KEY]"
  //> Brace or statement terminator.
  },
  //> Brace or statement terminator.
  {
    //> Source statement or expression.
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    //> Source statement or expression.
    replacement: "[REDACTED_PRIVATE_KEY]"
  //> Brace or statement terminator.
  }
//> Delimiter or separator.
];

//> Function declaration.
function redactSensitiveOutput(text) {
  //> Variable declaration.
  let output = String(text || "");
  //> Variable declaration.
  let redacted = false;
  //> For-loop header.
  for (const rule of SHELL_OUTPUT_REDACTION_RULES) {
    //> Source statement or expression.
    output = output.replace(rule.pattern, () => {
      //> Source statement or expression.
      redacted = true;
      //> Return a value.
      return rule.replacement;
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }
  //> Source statement or expression.
  output = output.replace(
    //> Source statement or expression.
    /((?:password|passwd|token|secret|api[_-]?key)\s*[:=]\s*)([^\s,;]+)/gi,
    //> Source statement or expression.
    (_, prefix) => {
      //> Source statement or expression.
      redacted = true;
      //> Return a value.
      return `${prefix}[REDACTED]`;
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  );
  //> Return a value.
  return {
    //> Source statement or expression.
    text: output,
    //> Source statement or expression.
    redacted
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function appendBoundedText(current, incoming, limit) {
  //> Variable declaration.
  const base = String(current || "");
  //> Variable declaration.
  const addition = String(incoming || "");
  //> Conditional branch.
  if (!addition) return { text: base, truncated: false };
  //> Conditional branch.
  if (base.length >= limit) return { text: base, truncated: true };
  //> Variable declaration.
  const next = `${base}${addition}`;
  //> Conditional branch.
  if (next.length <= limit) return { text: next, truncated: false };
  //> Variable declaration.
  const clipped = next.slice(0, limit);
  //> Return a value.
  return {
    //> Source statement or expression.
    text: `${clipped}\n[TRUNCATED]`,
    //> Source statement or expression.
    truncated: true
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function sanitizeShellMetadata(metadata) {
  //> Variable declaration.
  const record = asRecord(metadata);
  //> Conditional branch.
  if (!record) return null;
  //> Variable declaration.
  const out = { ...record };
  //> Conditional branch.
  if (typeof out.command === "string") {
    //> Source statement or expression.
    out.command = redactSensitiveOutput(out.command).text;
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (typeof out.stdoutPreview === "string") {
    //> Source statement or expression.
    out.stdoutPreview = redactSensitiveOutput(out.stdoutPreview).text;
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (typeof out.stderrPreview === "string") {
    //> Source statement or expression.
    out.stderrPreview = redactSensitiveOutput(out.stderrPreview).text;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Function declaration.
function readTaskToolCallApprovalToken(payload) {
  //> Variable declaration.
  const payloadRecord = asRecord(payload);
  //> Return a value.
  return normalizeText(payloadRecord?.toolCallApprovalToken) || null;
//> Brace or statement terminator.
}

//> Function declaration.
function readTaskToolCallPolicy(payload) {
  //> Variable declaration.
  const payloadRecord = asRecord(payload);
  //> Variable declaration.
  const policy = asRecord(payloadRecord?.toolCallPolicy);
  //> Return a value.
  return {
    //> Source statement or expression.
    dryRun: Boolean(policy?.dryRun)
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function readTaskRuntimeConfigResolution(payload) {
  //> Variable declaration.
  const payloadRecord = asRecord(payload);
  //> Variable declaration.
  const resolution = asRecord(payloadRecord?.runtimeConfigResolution);
  //> Conditional branch.
  if (!resolution) return null;

  //> Variable declaration.
  const effective = asRecord(resolution.effective);
  //> Conditional branch.
  if (!effective) return null;

  //> Variable declaration.
  const runtime = normalizeText(effective.runtime).toUpperCase();
  //> Conditional branch.
  if (runtime !== "LOCAL" && runtime !== "CLOUD") return null;

  //> Variable declaration.
  const endpoint = normalizeText(effective.endpoint);
  //> Variable declaration.
  const model = normalizeText(effective.model);
  //> Variable declaration.
  const apiKeyEnv = normalizeText(effective.apiKeyEnv) || null;
  //> Variable declaration.
  const requestTimeoutMs = clampInt(
    //> Source statement or expression.
    effective.requestTimeoutMs,
    //> Source statement or expression.
    clampInt(REQUEST_TIMEOUT_MS, 60000, 1000, 300000),
    //> Source statement or expression.
    1000,
    //> Source statement or expression.
    300000
  //> Delimiter or separator.
  );

  //> Return a value.
  return {
    //> Source statement or expression.
    digest: normalizeText(resolution.digest) || null,
    //> Source statement or expression.
    projectKey: normalizeText(resolution.projectKey) || null,
    //> Source statement or expression.
    projectName: normalizeText(resolution.projectName) || null,
    //> Source statement or expression.
    activeContextWindowId: normalizeText(resolution.activeContextWindowId) || null,
    //> Source statement or expression.
    activeContextOwnerAgentKey: normalizeText(resolution.activeContextOwnerAgentKey) || null,
    //> Source statement or expression.
    sourceChain: Array.isArray(resolution.sourceChain) ? resolution.sourceChain : [],
    //> Source statement or expression.
    effective: {
      //> Source statement or expression.
      runtime,
      //> Source statement or expression.
      endpoint,
      //> Source statement or expression.
      model,
      //> Source statement or expression.
      apiKeyEnv,
      //> Source statement or expression.
      requestTimeoutMs
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function evaluateOrchestratorTaskTransition(action, fromState, toState) {
  //> Conditional branch.
  if (action === "ROUTE_HANDOFF_TASK") {
    //> Conditional branch.
    if (fromState !== null) {
      //> Return a value.
      return { allowed: false, reason: "Handoff task creation requires fromState=null." };
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (toState === "QUEUED" || toState === "MANUAL_REQUIRED") {
      //> Return a value.
      return { allowed: true, reason: "Orchestrator handoff creation transition allowed." };
    //> Brace or statement terminator.
    }
    //> Return a value.
    return {
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason: "Handoff task creation can only target QUEUED or MANUAL_REQUIRED."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (action === "CLAIM_TASK") {
    //> Return a value.
    return fromState === "QUEUED" && toState === "RUNNING"
      //> Source statement or expression.
      ? { allowed: true, reason: "Orchestrator claim transition allowed." }
      //> Source statement or expression.
      : { allowed: false, reason: "Claim transition requires QUEUED -> RUNNING." };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (action === "COMPLETE_TASK") {
    //> Return a value.
    return fromState === "RUNNING" && toState === "DONE"
      //> Source statement or expression.
      ? { allowed: true, reason: "Orchestrator completion transition allowed." }
      //> Source statement or expression.
      : { allowed: false, reason: "Completion transition requires RUNNING -> DONE." };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (action === "CANCEL_TASK") {
    //> Return a value.
    return fromState === "RUNNING" && toState === "CANCELED"
      //> Source statement or expression.
      ? { allowed: true, reason: "Orchestrator cancel transition allowed." }
      //> Source statement or expression.
      : { allowed: false, reason: "Cancel transition requires RUNNING -> CANCELED." };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (action === "RETRY_TASK") {
    //> Return a value.
    return fromState === "RUNNING" && toState === "QUEUED"
      //> Source statement or expression.
      ? { allowed: true, reason: "Orchestrator retry transition allowed." }
      //> Source statement or expression.
      : { allowed: false, reason: "Retry transition requires RUNNING -> QUEUED." };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (action === "DEAD_LETTER_TASK") {
    //> Return a value.
    return fromState === "RUNNING" && toState === "DEAD_LETTER"
      //> Source statement or expression.
      ? { allowed: true, reason: "Orchestrator dead-letter transition allowed." }
      //> Source statement or expression.
      : {
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: "Dead-letter transition requires RUNNING -> DEAD_LETTER."
        //> Brace or statement terminator.
        };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (action === "RECOVER_STALE_RUNNING") {
    //> Return a value.
    return fromState === "RUNNING" && toState === "QUEUED"
      //> Source statement or expression.
      ? { allowed: true, reason: "Stale-running recovery transition allowed." }
      //> Source statement or expression.
      : {
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: "Stale-running recovery requires RUNNING -> QUEUED."
        //> Brace or statement terminator.
        };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return { allowed: false, reason: `Unsupported orchestrator task action: ${action}.` };
//> Brace or statement terminator.
}

//> Async function declaration.
async function recordLifecycleAudit(entry, db = prisma) {
  //> Await async value.
  await db.lifecycleAuditEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      entityType: entry.entityType,
      //> Source statement or expression.
      entityId: entry.entityId || null,
      //> Source statement or expression.
      actorRole: entry.actorRole,
      //> Source statement or expression.
      action: entry.action,
      //> Source statement or expression.
      fromState: entry.fromState || null,
      //> Source statement or expression.
      toState: entry.toState || null,
      //> Source statement or expression.
      allowed: Boolean(entry.allowed),
      //> Source statement or expression.
      reason: entry.reason,
      //> Source statement or expression.
      metadata: entry.metadata || undefined
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function verifyAndConsumeToolCallApproval(params) {
  //> Variable declaration.
  const { task, envelope, policyEvaluation, payload } = params;
  //> Conditional branch.
  if (!policyEvaluation.requiresApproval) {
    //> Return a value.
    return null;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const actionFingerprint = buildToolCallActionFingerprint(envelope);
  //> Variable declaration.
  const approvalToken = readTaskToolCallApprovalToken(payload);
  //> Conditional branch.
  if (!approvalToken) {
    //> Variable declaration.
    const reason =
      //> Source statement or expression.
      policyEvaluation.approvalReason ||
      //> String literal line.
      "Tool command policy requires explicit approval token before execution.";
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "TOOL_CALL_APPROVAL_VERIFY",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        code: "TOKEN_MISSING",
        //> Source statement or expression.
        actionFingerprint
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Throw error.
    throw new WorkerTaskError("TOOL_CALL_APPROVAL_REQUIRED", reason, false);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const verification = verifyToolCallApprovalToken({
    //> Source statement or expression.
    token: approvalToken,
    //> Source statement or expression.
    expectedActionFingerprint: actionFingerprint
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!verification.ok) {
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "TOOL_CALL_APPROVAL_VERIFY",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason: verification.reason,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        code: verification.code,
        //> Source statement or expression.
        tokenId: verification.tokenId,
        //> Source statement or expression.
        actionFingerprint
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (verification.tokenId) {
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TOOL_APPROVAL_TOKEN",
        //> Source statement or expression.
        entityId: verification.tokenId,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "CONSUME_APPROVAL_TOKEN",
        //> Source statement or expression.
        fromState: null,
        //> Source statement or expression.
        toState: null,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: verification.reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          code: verification.code,
          //> Source statement or expression.
          taskId: task.id,
          //> Source statement or expression.
          actionFingerprint
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
    //> Throw error.
    throw new WorkerTaskError("TOOL_CALL_APPROVAL_INVALID", verification.reason, false);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const priorUse = await prisma.lifecycleAuditEvent.findFirst({
    //> Source statement or expression.
    where: {
      //> Source statement or expression.
      entityType: "TOOL_APPROVAL_TOKEN",
      //> Source statement or expression.
      entityId: verification.payload.tokenId,
      //> Source statement or expression.
      action: "CONSUME_APPROVAL_TOKEN",
      //> Source statement or expression.
      allowed: true
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    select: { id: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (priorUse) {
    //> Variable declaration.
    const reason = "Approval token replay rejected: token was already consumed.";
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "TOOL_CALL_APPROVAL_VERIFY",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        code: "TOKEN_REPLAY",
        //> Source statement or expression.
        tokenId: verification.payload.tokenId,
        //> Source statement or expression.
        actionFingerprint
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TOOL_APPROVAL_TOKEN",
      //> Source statement or expression.
      entityId: verification.payload.tokenId,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "CONSUME_APPROVAL_TOKEN",
      //> Source statement or expression.
      fromState: null,
      //> Source statement or expression.
      toState: null,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        code: "TOKEN_REPLAY",
        //> Source statement or expression.
        taskId: task.id,
        //> Source statement or expression.
        actionFingerprint
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Throw error.
    throw new WorkerTaskError("TOOL_CALL_APPROVAL_REPLAY", reason, false);
  //> Brace or statement terminator.
  }

  //> Await async value.
  await recordLifecycleAudit({
    //> Source statement or expression.
    entityType: "TOOL_APPROVAL_TOKEN",
    //> Source statement or expression.
    entityId: verification.payload.tokenId,
    //> Source statement or expression.
    actorRole: "ORCHESTRATOR",
    //> Source statement or expression.
    action: "CONSUME_APPROVAL_TOKEN",
    //> Source statement or expression.
    fromState: null,
    //> Source statement or expression.
    toState: "CONSUMED",
    //> Source statement or expression.
    allowed: true,
    //> Source statement or expression.
    reason: "Approval token consumed for tool-call execution.",
    //> Source statement or expression.
    metadata: {
      //> Source statement or expression.
      taskId: task.id,
      //> Source statement or expression.
      actionFingerprint,
      //> Source statement or expression.
      approverUserId: verification.payload.approverUserId,
      //> Source statement or expression.
      approverEmail: verification.payload.approverEmail,
      //> Source statement or expression.
      expiresAt: verification.payload.expiresAt
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Await async value.
  await recordLifecycleAudit({
    //> Source statement or expression.
    entityType: "TASK",
    //> Source statement or expression.
    entityId: task.id,
    //> Source statement or expression.
    actorRole: "ORCHESTRATOR",
    //> Source statement or expression.
    action: "TOOL_CALL_APPROVAL_VERIFY",
    //> Source statement or expression.
    fromState: task.status,
    //> Source statement or expression.
    toState: task.status,
    //> Source statement or expression.
    allowed: true,
    //> Source statement or expression.
    reason: "Tool-call approval token verified and consumed.",
    //> Source statement or expression.
    metadata: {
      //> Source statement or expression.
      tokenId: verification.payload.tokenId,
      //> Source statement or expression.
      approverUserId: verification.payload.approverUserId,
      //> Source statement or expression.
      approverEmail: verification.payload.approverEmail,
      //> Source statement or expression.
      actionFingerprint,
      //> Source statement or expression.
      expiresAt: verification.payload.expiresAt
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Return a value.
  return verification.payload;
//> Brace or statement terminator.
}

//> Function declaration.
function failurePolicy(className) {
  //> Conditional branch.
  if (className === "STALE_RUNNING_DETECTED") {
    //> Return a value.
    return {
      //> Source statement or expression.
      severity: "MEDIUM",
      //> Source statement or expression.
      fallbackAction: "REQUEUE",
      //> Source statement or expression.
      remediation:
        //> String literal line.
        "Inspect stale-running owner context and verify orchestrator lease recovery before further retries."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (className === "EXECUTION_RETRY_EXHAUSTED") {
    //> Return a value.
    return {
      //> Source statement or expression.
      severity: "HIGH",
      //> Source statement or expression.
      fallbackAction: "DEAD_LETTER",
      //> Source statement or expression.
      remediation:
        //> String literal line.
        "Review dead-letter diagnostics and route to manual-required remediation if autonomous retry is exhausted."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    severity: "LOW",
    //> Source statement or expression.
    fallbackAction: "ALERT_ONLY",
    //> Source statement or expression.
    remediation: "Review fallback diagnostics."
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function recordAlphaFailureEvent(entry, db = prisma) {
  //> Variable declaration.
  const policy = failurePolicy(entry.failureClass);
  //> Await async value.
  await db.alphaFailureEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      failureClass: entry.failureClass,
      //> Source statement or expression.
      severity: policy.severity,
      //> Source statement or expression.
      fallbackAction: policy.fallbackAction,
      //> Source statement or expression.
      projectKey: entry.projectKey || null,
      //> Source statement or expression.
      projectName: entry.projectName || null,
      //> Source statement or expression.
      issueNumber: entry.issueNumber ?? null,
      //> Source statement or expression.
      taskId: entry.taskId || null,
      //> Source statement or expression.
      threadId: entry.threadId || null,
      //> Source statement or expression.
      leaseHealth: entry.leaseHealth || null,
      //> Source statement or expression.
      contextWindowId: entry.contextWindowId || null,
      //> Source statement or expression.
      remediation: policy.remediation,
      //> Source statement or expression.
      metadata: entry.metadata || undefined
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Function declaration.
function isoOrNull(value) {
  //> Conditional branch.
  if (!(value instanceof Date)) return null;
  //> Return a value.
  return value.toISOString();
//> Brace or statement terminator.
}

//> Variable declaration.
let leaseHeld = false;
//> Variable declaration.
let isShuttingDown = false;
//> Variable declaration.
let lastLeaseConflictKey = null;
//> Variable declaration.
let lastLeaseConflictAt = 0;

//> Function declaration.
function readAgentSetting(agentKey) {
  //> Try block start.
  try {
    //> Variable declaration.
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    //> Variable declaration.
    const parsed = JSON.parse(raw);
    //> Variable declaration.
    const all = Array.isArray(parsed?.agents) ? parsed.agents : [];
    //> Variable declaration.
    const wanted = normalizeLower(agentKey);
    //> Variable declaration.
    const row = all.find(
      //> Source statement or expression.
      (r) =>
        //> Source statement or expression.
        r &&
        //> Source statement or expression.
        typeof r === "object" &&
        //> Source statement or expression.
        typeof r.agentName === "string" &&
        //> Source statement or expression.
        normalizeLower(r.agentName) === wanted
    //> Delimiter or separator.
    );
    //> Conditional branch.
    if (!row) return null;
    //> Return a value.
    return {
      //> Source statement or expression.
      agentUrl: typeof row.agentUrl === "string" ? row.agentUrl.trim() : "",
      //> Source statement or expression.
      agentModel: typeof row.agentModel === "string" ? row.agentModel.trim() : "",
      //> Source statement or expression.
      agentApiKeyEnv:
        //> Source statement or expression.
        typeof row.agentApiKeyEnv === "string" ? row.agentApiKeyEnv.trim() : ""
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return null;
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function readEnvVar(name) {
  //> Conditional branch.
  if (!name) return "";
  //> Return a value.
  return String(process.env[name] || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function resolveAgentExecutionConfig(agent, runtimeResolution = null) {
  //> Conditional branch.
  if (!agent || !agent.key) {
    //> Throw error.
    throw new Error("Missing agent record.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const setting = readAgentSetting(agent.key);
  //> Variable declaration.
  const displayName = agent.displayName || agent.key;
  //> Variable declaration.
  const resolutionEffective = runtimeResolution?.effective || null;
  //> Variable declaration.
  const runtimeMatches = resolutionEffective?.runtime === agent.runtime;
  //> Variable declaration.
  const timeoutOverride = runtimeMatches ? resolutionEffective.requestTimeoutMs : null;

  //> Conditional branch.
  if (agent.runtime === "LOCAL") {
    //> Variable declaration.
    const resolved = {
      //> Source statement or expression.
      runtime: "LOCAL",
      //> Source statement or expression.
      provider: "ollama",
      //> Source statement or expression.
      displayName,
      //> Source statement or expression.
      endpoint: setting?.agentUrl || OLLAMA_BASE_URL,
      //> Source statement or expression.
      model: setting?.agentModel || agent.model || WORKER_MODEL || OLLAMA_MODEL,
      //> Source statement or expression.
      apiKey: null,
      //> Source statement or expression.
      apiKeyEnv: "",
      //> Source statement or expression.
      requestTimeoutMs: clampInt(timeoutOverride ?? REQUEST_TIMEOUT_MS, 60000, 1000, 300000),
      //> Source statement or expression.
      runtimeConfigDigest: runtimeResolution?.digest || null,
      //> Source statement or expression.
      runtimeConfigSourceChain: runtimeResolution?.sourceChain || []
    //> Brace or statement terminator.
    };
    //> Conditional branch.
    if (runtimeMatches) {
      //> Conditional branch.
      if (resolutionEffective.endpoint) resolved.endpoint = resolutionEffective.endpoint;
      //> Conditional branch.
      if (resolutionEffective.model) resolved.model = resolutionEffective.model;
    //> Brace or statement terminator.
    }
    //> Return a value.
    return resolved;
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (agent.runtime === "CLOUD") {
    //> Variable declaration.
    const apiKeyEnv =
      //> Source statement or expression.
      (runtimeMatches && resolutionEffective.apiKeyEnv) ||
      //> Source statement or expression.
      setting?.agentApiKeyEnv ||
      //> String literal line.
      "OPENAI_API_KEY";
    //> Variable declaration.
    const apiKey = readEnvVar(apiKeyEnv) || OPENAI_API_KEY || "";
    //> Variable declaration.
    const resolved = {
      //> Source statement or expression.
      runtime: "CLOUD",
      //> Source statement or expression.
      provider: "openai",
      //> Source statement or expression.
      displayName,
      //> Source statement or expression.
      endpoint: setting?.agentUrl || OPENAI_BASE_URL,
      //> Source statement or expression.
      model: setting?.agentModel || agent.model || OPENAI_MODEL,
      //> Source statement or expression.
      apiKey,
      //> Source statement or expression.
      apiKeyEnv,
      //> Source statement or expression.
      requestTimeoutMs: clampInt(timeoutOverride ?? REQUEST_TIMEOUT_MS, 60000, 1000, 300000),
      //> Source statement or expression.
      runtimeConfigDigest: runtimeResolution?.digest || null,
      //> Source statement or expression.
      runtimeConfigSourceChain: runtimeResolution?.sourceChain || []
    //> Brace or statement terminator.
    };
    //> Conditional branch.
    if (runtimeMatches) {
      //> Conditional branch.
      if (resolutionEffective.endpoint) resolved.endpoint = resolutionEffective.endpoint;
      //> Conditional branch.
      if (resolutionEffective.model) resolved.model = resolutionEffective.model;
    //> Brace or statement terminator.
    }
    //> Return a value.
    return resolved;
  //> Brace or statement terminator.
  }

  //> Throw error.
  throw new Error(
    //> String literal line.
    `Unsupported runtime "${agent.runtime}" for @${agent.key}. Set runtime to LOCAL or CLOUD.`
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveCanonicalAgentKey(rawAgentKey) {
  //> Conditional branch.
  if (!rawAgentKey) return null;
  //> Variable declaration.
  const existing = await prisma.agent.findFirst({
    //> Source statement or expression.
    where: { key: { equals: rawAgentKey, mode: "insensitive" } },
    //> Source statement or expression.
    select: { key: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!existing?.key) {
    //> Throw error.
    throw new Error(
      //> String literal line.
      `Worker agent "${rawAgentKey}" is not registered. Create it on /agents first.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return existing.key;
//> Brace or statement terminator.
}

//> Async function declaration.
async function heartbeat(agentKey, leaseMeta = {}) {
  //> Conditional branch.
  if (!agentKey) return;
  //> Variable declaration.
  const existing = await prisma.agent.findFirst({
    //> Source statement or expression.
    where: { key: { equals: agentKey, mode: "insensitive" } },
    //> Source statement or expression.
    select: { key: true, displayName: true, runtime: true, model: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!existing?.key) {
    //> Throw error.
    throw new Error(`Agent @${agentKey} is not registered.`);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const resolved = existing ? resolveAgentExecutionConfig(existing) : null;

  //> Await async value.
  await prisma.agent.update({
    //> Source statement or expression.
    where: { key: existing.key },
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      model: resolved?.model || undefined,
      //> Source statement or expression.
      host: WORKER_HOST,
      //> Source statement or expression.
      lastHeartbeatAt: new Date(),
      //> Source statement or expression.
      lastHeartbeatMeta: { pid: process.pid, pollMs: POLL_MS, ...leaseMeta }
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Return a value.
  return existing.key;
//> Brace or statement terminator.
}

//> Async function declaration.
async function ensureLeaseRow(tx = prisma) {
  //> Return a value.
  return tx.orchestratorLease.upsert({
    //> Source statement or expression.
    where: { id: ORCHESTRATOR_LEASE_ID },
    //> Source statement or expression.
    create: { id: ORCHESTRATOR_LEASE_ID },
    //> Source statement or expression.
    update: {}
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function lockLeaseRow(tx) {
  //> Await async value.
  await tx.$queryRaw`SELECT "id" FROM "OrchestratorLease" WHERE "id" = ${ORCHESTRATOR_LEASE_ID} FOR UPDATE`;
  //> Return a value.
  return tx.orchestratorLease.findUnique({
    //> Source statement or expression.
    where: { id: ORCHESTRATOR_LEASE_ID }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function writeLeaseAudit(tx, entry) {
  //> Await async value.
  await tx.orchestratorLeaseAudit.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      leaseId: ORCHESTRATOR_LEASE_ID,
      //> Source statement or expression.
      code: entry.code,
      //> Source statement or expression.
      message: entry.message,
      //> Source statement or expression.
      ownerId: entry.ownerId || null,
      //> Source statement or expression.
      previousOwnerId: entry.previousOwnerId || null,
      //> Source statement or expression.
      metadata: entry.metadata || undefined
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Function declaration.
function describeLeaseState(lease) {
  //> Conditional branch.
  if (!lease?.ownerId) return "no active owner";
  //> Return a value.
  return `${lease.ownerId} (expires ${isoOrNull(lease.expiresAt) || "unknown"})`;
//> Brace or statement terminator.
}

//> Async function declaration.
async function acquireOrRenewOrchestratorLease(reason) {
  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureLeaseRow(tx);
    //> Variable declaration.
    const lease = await lockLeaseRow(tx);
    //> Variable declaration.
    const now = new Date();
    //> Variable declaration.
    const expiresAt = new Date(now.getTime() + ORCHESTRATOR_LEASE_TTL_MS);

    //> Variable declaration.
    const hasOwner = Boolean(lease?.ownerId);
    //> Variable declaration.
    const sameOwner = lease?.ownerId === ORCHESTRATOR_OWNER_ID;
    //> Variable declaration.
    const expired = !lease?.expiresAt || lease.expiresAt.getTime() <= now.getTime();

    //> Conditional branch.
    if (!hasOwner || sameOwner || expired) {
      //> Variable declaration.
      const previousOwnerId = lease?.ownerId || null;
      //> Variable declaration.
      const reclaimed = Boolean(hasOwner && !sameOwner && expired);
      //> Variable declaration.
      const code = reclaimed
        //> Source statement or expression.
        ? "LEASE_RECLAIM_STALE"
        //> Source statement or expression.
        : hasOwner
        //> Source statement or expression.
        ? "LEASE_RENEWED"
        //> Source statement or expression.
        : "LEASE_ACQUIRED";
      //> Variable declaration.
      const message = reclaimed
        //> Source statement or expression.
        ? `Stale orchestrator lease reclaimed by ${ORCHESTRATOR_OWNER_ID}. Previous owner ${previousOwnerId} expired at ${isoOrNull(
            //> Source statement or expression.
            lease?.expiresAt
          //> Source statement or expression.
          )}.`
        //> Source statement or expression.
        : sameOwner
        //> Source statement or expression.
        ? `Orchestrator lease renewed by ${ORCHESTRATOR_OWNER_ID}.`
        //> Source statement or expression.
        : `Orchestrator lease acquired by ${ORCHESTRATOR_OWNER_ID}.`;

      //> Variable declaration.
      const updated = await tx.orchestratorLease.update({
        //> Source statement or expression.
        where: { id: ORCHESTRATOR_LEASE_ID },
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          ownerId: ORCHESTRATOR_OWNER_ID,
          //> Source statement or expression.
          ownerHost: WORKER_HOST,
          //> Source statement or expression.
          ownerPid: process.pid,
          //> Source statement or expression.
          ownerAgentKey: WORKER_AGENT_KEY || null,
          //> Source statement or expression.
          acquiredAt: sameOwner ? lease?.acquiredAt || now : now,
          //> Source statement or expression.
          lastHeartbeatAt: now,
          //> Source statement or expression.
          expiresAt,
          //> Source statement or expression.
          heartbeatCount: sameOwner
            //> Source statement or expression.
            ? { increment: 1 }
            //> Source statement or expression.
            : 1
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });

      //> Conditional branch.
      if (code !== "LEASE_RENEWED") {
        //> Await async value.
        await writeLeaseAudit(tx, {
          //> Source statement or expression.
          code,
          //> Source statement or expression.
          message,
          //> Source statement or expression.
          ownerId: ORCHESTRATOR_OWNER_ID,
          //> Source statement or expression.
          previousOwnerId,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            reason,
            //> Source statement or expression.
            ownerAgentKey: WORKER_AGENT_KEY || null,
            //> Source statement or expression.
            ownerHost: WORKER_HOST,
            //> Source statement or expression.
            ownerPid: process.pid,
            //> Source statement or expression.
            expiresAt: updated.expiresAt.toISOString()
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
      //> Brace or statement terminator.
      }

      //> Return a value.
      return {
        //> Source statement or expression.
        held: true,
        //> Source statement or expression.
        code,
        //> Source statement or expression.
        lease: updated,
        //> Source statement or expression.
        reason
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Return a value.
    return {
      //> Source statement or expression.
      held: false,
      //> Source statement or expression.
      code: "LEASE_HELD_BY_ACTIVE_OWNER",
      //> Source statement or expression.
      lease,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      message: `Competing orchestrator writer rejected: lease held by ${describeLeaseState(
        //> Source statement or expression.
        lease
      //> Source statement or expression.
      )}.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function releaseOrchestratorLease(reason) {
  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureLeaseRow(tx);
    //> Variable declaration.
    const lease = await lockLeaseRow(tx);
    //> Variable declaration.
    const now = new Date();
    //> Conditional branch.
    if (!lease || lease.ownerId !== ORCHESTRATOR_OWNER_ID) {
      //> Return a value.
      return { released: false, lease };
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const updated = await tx.orchestratorLease.update({
      //> Source statement or expression.
      where: { id: ORCHESTRATOR_LEASE_ID },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        ownerId: null,
        //> Source statement or expression.
        ownerHost: null,
        //> Source statement or expression.
        ownerPid: null,
        //> Source statement or expression.
        ownerAgentKey: null,
        //> Source statement or expression.
        expiresAt: now,
        //> Source statement or expression.
        lastHeartbeatAt: now
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Await async value.
    await writeLeaseAudit(tx, {
      //> Source statement or expression.
      code: "LEASE_RELEASED",
      //> Source statement or expression.
      message: `Orchestrator lease released by ${ORCHESTRATOR_OWNER_ID}.`,
      //> Source statement or expression.
      ownerId: ORCHESTRATOR_OWNER_ID,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        ownerHost: WORKER_HOST,
        //> Source statement or expression.
        ownerPid: process.pid
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Return a value.
    return { released: true, lease: updated };
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function withLeaseAuthority(operation, mutation) {
  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Await async value.
    await ensureLeaseRow(tx);
    //> Variable declaration.
    const lease = await lockLeaseRow(tx);
    //> Variable declaration.
    const now = new Date();
    //> Variable declaration.
    const active = Boolean(
      //> Source statement or expression.
      lease?.ownerId === ORCHESTRATOR_OWNER_ID &&
        //> Source statement or expression.
        lease?.expiresAt &&
        //> Source statement or expression.
        lease.expiresAt.getTime() > now.getTime()
    //> Delimiter or separator.
    );
    //> Conditional branch.
    if (!active) {
      //> Variable declaration.
      const message = `Blocked task lifecycle write (${operation}): lease held by ${describeLeaseState(
        //> Source statement or expression.
        lease
      //> Source statement or expression.
      )}.`;
      //> Await async value.
      await writeLeaseAudit(tx, {
        //> Source statement or expression.
        code: "LEASE_WRITE_REJECTED",
        //> Source statement or expression.
        message,
        //> Source statement or expression.
        ownerId: ORCHESTRATOR_OWNER_ID,
        //> Source statement or expression.
        previousOwnerId: lease?.ownerId || null,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          operation,
          //> Source statement or expression.
          ownerHost: WORKER_HOST,
          //> Source statement or expression.
          ownerPid: process.pid
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Throw error.
      throw new WorkerTaskError("LEASE_NOT_HELD", message, true);
    //> Brace or statement terminator.
    }
    //> Return a value.
    return mutation(tx);
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function maintainOrchestratorLease(reason) {
  //> Variable declaration.
  const outcome = await acquireOrRenewOrchestratorLease(reason);
  //> Conditional branch.
  if (outcome.held) {
    //> Variable declaration.
    const becameHolder = !leaseHeld;
    //> Source statement or expression.
    leaseHeld = true;
    //> Conditional branch.
    if (becameHolder || outcome.code !== "LEASE_RENEWED") {
      //> Source statement or expression.
      console.log(
        //> String literal line.
        `[mvp-factory-control-worker] lease ${outcome.code.toLowerCase()} owner=${ORCHESTRATOR_OWNER_ID} ttlMs=${ORCHESTRATOR_LEASE_TTL_MS}`
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
    //> Return a value.
    return true;
  //> Brace or statement terminator.
  }

  //> Source statement or expression.
  leaseHeld = false;
  //> Variable declaration.
  const conflictKey = `${outcome?.lease?.ownerId || ""}:${isoOrNull(outcome?.lease?.expiresAt) || ""}`;
  //> Variable declaration.
  const now = Date.now();
  //> Conditional branch.
  if (
    //> Source statement or expression.
    conflictKey !== lastLeaseConflictKey ||
    //> Source statement or expression.
    now - lastLeaseConflictAt >= Math.max(POLL_MS * 5, 5000)
  //> Source statement or expression.
  ) {
    //> Source statement or expression.
    lastLeaseConflictKey = conflictKey;
    //> Source statement or expression.
    lastLeaseConflictAt = now;
    //> Source statement or expression.
    console.log(`[mvp-factory-control-worker] ${outcome.message}`);
  //> Brace or statement terminator.
  }
  //> Return a value.
  return false;
//> Brace or statement terminator.
}

//> Async function declaration.
async function recoverStaleRunningTasks() {
  //> Variable declaration.
  const cutoff = new Date(Date.now() - ORCHESTRATOR_STALE_RUNNING_MS);
  //> Variable declaration.
  const result = await withLeaseAuthority("recover-stale-running", async (tx) => {
    //> Variable declaration.
    const decision = evaluateOrchestratorTaskTransition(
      //> String literal line.
      "RECOVER_STALE_RUNNING",
      //> String literal line.
      "RUNNING",
      //> String literal line.
      "QUEUED"
    //> Delimiter or separator.
    );
    //> Conditional branch.
    if (!decision.allowed) {
      //> Await async value.
      await recordLifecycleAudit(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "RECOVER_STALE_RUNNING",
          //> Source statement or expression.
          fromState: "RUNNING",
          //> Source statement or expression.
          toState: "QUEUED",
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: decision.reason
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
      //> Throw error.
      throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const updated = await tx.agentTask.updateMany({
      //> Source statement or expression.
      where: {
        //> Source statement or expression.
        status: "RUNNING",
        //> Source statement or expression.
        startedAt: { lt: cutoff }
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        status: "QUEUED",
        //> Source statement or expression.
        startedAt: null,
        //> Source statement or expression.
        error:
          //> String literal line.
          "Recovered by orchestrator after stale running timeout (previous owner lost lease).",
        //> Source statement or expression.
        nextAttemptAt: new Date()
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (updated.count > 0) {
      //> Await async value.
      await recordLifecycleAudit(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "RECOVER_STALE_RUNNING",
          //> Source statement or expression.
          fromState: "RUNNING",
          //> Source statement or expression.
          toState: "QUEUED",
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: decision.reason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            count: updated.count,
            //> Source statement or expression.
            cutoff: cutoff.toISOString()
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
      //> Await async value.
      await recordAlphaFailureEvent(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          failureClass: "STALE_RUNNING_DETECTED",
          //> Source statement or expression.
          issueNumber: null,
          //> Source statement or expression.
          leaseHealth: "STALE",
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            count: updated.count,
            //> Source statement or expression.
            cutoff: cutoff.toISOString(),
            //> Source statement or expression.
            staleRunningMs: ORCHESTRATOR_STALE_RUNNING_MS
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
      //> Await async value.
      await writeLeaseAudit(tx, {
        //> Source statement or expression.
        code: "STALE_RUNNING_TASKS_RECOVERED",
        //> Source statement or expression.
        message: `Recovered ${updated.count} stale RUNNING task(s) back to QUEUED.`,
        //> Source statement or expression.
        ownerId: ORCHESTRATOR_OWNER_ID,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          cutoff: cutoff.toISOString(),
          //> Source statement or expression.
          staleRunningMs: ORCHESTRATOR_STALE_RUNNING_MS
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
    //> Return a value.
    return updated.count;
  //> Brace or statement terminator.
  });
  //> Return a value.
  return result;
//> Brace or statement terminator.
}

//> Async function declaration.
async function claimNextTask(agentKey) {
  //> Return a value.
  return withLeaseAuthority("claim-next-task", async (tx) => {
    //> Variable declaration.
    const now = new Date();
    //> Variable declaration.
    const where = {
      //> Source statement or expression.
      status: "QUEUED",
      //> Source statement or expression.
      nextAttemptAt: { lte: now },
      //> Source statement or expression.
      ...(agentKey ? { agentKey } : {}),
      //> Source statement or expression.
      agent: {
        //> Source statement or expression.
        is: {
          //> Source statement or expression.
          enabled: true,
          //> Source statement or expression.
          readiness: "READY",
          //> Source statement or expression.
          runtime: { in: ["LOCAL", "CLOUD"] }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    };

    //> Variable declaration.
    const next = await tx.agentTask.findFirst({
      //> Source statement or expression.
      where,
      //> Source statement or expression.
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      //> Source statement or expression.
      include: {
        //> Source statement or expression.
        agent: {
          //> Source statement or expression.
          select: { key: true, displayName: true, runtime: true, model: true, controlRole: true }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (!next) return null;

    //> Variable declaration.
    const claimed = await tx.agentTask.updateMany({
      //> Source statement or expression.
      where: { id: next.id, status: "QUEUED", nextAttemptAt: { lte: now } },
      //> Source statement or expression.
      data: { status: "RUNNING", startedAt: new Date() }
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (claimed.count !== 1) return null;

    //> Variable declaration.
    const decision = evaluateOrchestratorTaskTransition(
      //> String literal line.
      "CLAIM_TASK",
      //> Source statement or expression.
      next.status,
      //> String literal line.
      "RUNNING"
    //> Delimiter or separator.
    );
    //> Conditional branch.
    if (!decision.allowed) {
      //> Await async value.
      await recordLifecycleAudit(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: next.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "CLAIM_TASK",
          //> Source statement or expression.
          fromState: next.status,
          //> Source statement or expression.
          toState: "RUNNING",
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: decision.reason
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
      //> Throw error.
      throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
    //> Brace or statement terminator.
    }

    //> Await async value.
    await recordLifecycleAudit(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: next.id,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "CLAIM_TASK",
        //> Source statement or expression.
        fromState: next.status,
        //> Source statement or expression.
        toState: "RUNNING",
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        reason: decision.reason
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      tx
    //> Delimiter or separator.
    );

    //> Return a value.
    return tx.agentTask.findUnique({
      //> Source statement or expression.
      where: { id: next.id },
      //> Source statement or expression.
      include: {
        //> Source statement or expression.
        agent: {
          //> Source statement or expression.
          select: { key: true, displayName: true, runtime: true, model: true, controlRole: true }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function taskIntakeDecision(agentKey, db = prisma) {
  //> Variable declaration.
  const agent = await db.agent.findUnique({
    //> Source statement or expression.
    where: { key: agentKey },
    //> Source statement or expression.
    select: { enabled: true, runtime: true, readiness: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!agent) {
    //> Return a value.
    return {
      //> Source statement or expression.
      status: "MANUAL_REQUIRED",
      //> Source statement or expression.
      error: `Agent @${agentKey} is not registered in War Room.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!agent.enabled) {
    //> Return a value.
    return {
      //> Source statement or expression.
      status: "MANUAL_REQUIRED",
      //> Source statement or expression.
      error: `Agent @${agentKey} is disabled.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (agent.runtime === "MANUAL") {
    //> Return a value.
    return {
      //> Source statement or expression.
      status: "MANUAL_REQUIRED",
      //> Source statement or expression.
      error: `Agent @${agentKey} uses MANUAL runtime and cannot execute automatically.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (agent.readiness === "NOT_READY") {
    //> Return a value.
    return {
      //> Source statement or expression.
      status: "MANUAL_REQUIRED",
      //> Source statement or expression.
      error: NOT_READY_REASON
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (agent.readiness === "PAUSED") {
    //> Return a value.
    return {
      //> Source statement or expression.
      status: "QUEUED",
      //> Source statement or expression.
      error: PAUSED_REASON
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return { status: "QUEUED", error: null };
//> Brace or statement terminator.
}

//> Async function declaration.
async function postMessage(threadId, authorType, authorKey, content, meta, db = prisma) {
  //> Conditional branch.
  if (!threadId) return;
  //> Return a value.
  return db.chatMessage.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      threadId,
      //> Source statement or expression.
      authorType,
      //> Source statement or expression.
      authorKey: authorKey || null,
      //> Source statement or expression.
      content,
      //> Source statement or expression.
      meta: meta || undefined
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Function declaration.
function parseAgentHandoffs(text) {
  //> Conditional branch.
  if (!text) return [];
  //> Variable declaration.
  const lines = String(text).split(/\r?\n/);
  //> Variable declaration.
  const out = [];

  //> For-loop header.
  for (const line of lines) {
    //> Variable declaration.
    const trimmed = line.trim();
    //> Conditional branch.
    if (!trimmed.startsWith("@")) continue;
    //> Variable declaration.
    const m = /^@([A-Za-z0-9_-]+)\s+([\s\S]+)$/.exec(trimmed);
    //> Conditional branch.
    if (!m) continue;
    //> Source statement or expression.
    out.push({
      //> Source statement or expression.
      target: m[1],
      //> Source statement or expression.
      command: m[2].trim(),
      //> Source statement or expression.
      rawMention: trimmed
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return out.filter((h) => h.command.length > 0);
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveKnownAgentKey(rawAgentKey, db = prisma) {
  //> Variable declaration.
  const wanted = normalizeLower(rawAgentKey);
  //> Conditional branch.
  if (!wanted) return null;

  //> Variable declaration.
  const local = await db.agent.findFirst({
    //> Source statement or expression.
    where: { key: { equals: wanted, mode: "insensitive" } },
    //> Source statement or expression.
    select: { key: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (local?.key) return local.key;
  //> Return a value.
  return null;
//> Brace or statement terminator.
}

//> Async function declaration.
async function routeAgentHandoffs(params) {
  //> Variable declaration.
  const db = params?.db || prisma;
  //> Variable declaration.
  const sourceThreadId = params?.sourceThreadId || null;
  //> Conditional branch.
  if (!sourceThreadId) return 0;

  //> Variable declaration.
  const handoffs = parseAgentHandoffs(params.sourceContent);
  //> Conditional branch.
  if (!handoffs.length) return 0;
  //> Variable declaration.
  const requestedByRole = String(params?.requestedByRole || "BETA").toUpperCase();
  //> Conditional branch.
  if (requestedByRole !== "ALPHA") {
    //> Variable declaration.
    const denialReason =
      //> String literal line.
      "Role boundary denied: only ALPHA agents can emit control handoff actions.";
    //> Await async value.
    await recordLifecycleAudit(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: params?.sourceTaskId || null,
        //> Source statement or expression.
        actorRole: "WORKER",
        //> Source statement or expression.
        action: "BETA_CONTROL_DENIED",
        //> Source statement or expression.
        fromState: "RUNNING",
        //> Source statement or expression.
        toState: null,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: denialReason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          requestedByAgent: params?.requestedByAgent || null,
          //> Source statement or expression.
          requestedByRole
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db
    //> Delimiter or separator.
    );
    //> Await async value.
    await postMessage(
      //> Source statement or expression.
      sourceThreadId,
      //> String literal line.
      "SYSTEM",
      //> Source statement or expression.
      null,
      //> String literal line.
      `${denialReason} Source=@${params?.requestedByAgent || "unknown"} (${requestedByRole}).`,
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        kind: "role_boundary_denied",
        //> Source statement or expression.
        requestedByAgent: params?.requestedByAgent || null,
        //> Source statement or expression.
        requestedByRole
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db
    //> Delimiter or separator.
    );
    //> Return a value.
    return 0;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  let routedCount = 0;

  //> For-loop header.
  for (const handoff of handoffs) {
    // eslint-disable-next-line no-await-in-loop
    //> Variable declaration.
    const targetAgentKey = await resolveKnownAgentKey(handoff.target, db);
    //> Conditional branch.
    if (!targetAgentKey) continue;

    //> Conditional branch.
    if (normalizeLower(targetAgentKey) === normalizeLower(params.requestedByAgent)) {
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const trace = {
      //> Source statement or expression.
      requestedByAgent: params.requestedByAgent,
      //> Source statement or expression.
      sourceThreadId,
      //> Source statement or expression.
      sourceMessageId: params.sourceMessageId,
      //> Source statement or expression.
      handoffContext: {
        //> Source statement or expression.
        rawMention: handoff.rawMention,
        //> Source statement or expression.
        sourceTaskId: params.sourceTaskId,
        //> Source statement or expression.
        sourceTaskTitle: params.sourceTaskTitle
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    };

    // eslint-disable-next-line no-await-in-loop
    //> Variable declaration.
    const intake = await taskIntakeDecision(targetAgentKey, db);
    //> Variable declaration.
    const routeDecision = evaluateOrchestratorTaskTransition(
      //> String literal line.
      "ROUTE_HANDOFF_TASK",
      //> Source statement or expression.
      null,
      //> Source statement or expression.
      intake.status
    //> Delimiter or separator.
    );
    //> Conditional branch.
    if (!routeDecision.allowed) {
      // eslint-disable-next-line no-await-in-loop
      //> Await async value.
      await recordLifecycleAudit(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "ROUTE_HANDOFF_TASK",
          //> Source statement or expression.
          fromState: null,
          //> Source statement or expression.
          toState: intake.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: routeDecision.reason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            targetAgentKey,
            //> Source statement or expression.
            requestedByAgent: params.requestedByAgent
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        db
      //> Delimiter or separator.
      );
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const routedTask = await db.agentTask.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        agentKey: targetAgentKey,
        //> Source statement or expression.
        status: intake.status,
        //> Source statement or expression.
        issueNumber: params.issueNumber ?? null,
        //> Source statement or expression.
        threadId: sourceThreadId,
        //> Source statement or expression.
        title: handoff.command,
        //> Source statement or expression.
        error: intake.error,
        //> Source statement or expression.
        ...(intake.status === "MANUAL_REQUIRED" ? { finishedAt: new Date() } : {}),
        //> Source statement or expression.
        payload: {
          //> Source statement or expression.
          kind: "agent_handoff",
          //> Source statement or expression.
          command: handoff.command,
          //> Source statement or expression.
          ...trace
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    // eslint-disable-next-line no-await-in-loop
    //> Await async value.
    await recordLifecycleAudit(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: routedTask.id,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "ROUTE_HANDOFF_TASK",
        //> Source statement or expression.
        fromState: null,
        //> Source statement or expression.
        toState: intake.status,
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        reason: routeDecision.reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          targetAgentKey,
          //> Source statement or expression.
          requestedByAgent: params.requestedByAgent
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db
    //> Delimiter or separator.
    );

    // eslint-disable-next-line no-await-in-loop
    //> Await async value.
    await postMessage(
      //> Source statement or expression.
      sourceThreadId,
      //> String literal line.
      "SYSTEM",
      //> Source statement or expression.
      null,
      //> Source statement or expression.
      intake.status === "MANUAL_REQUIRED"
        //> Source statement or expression.
        ? `Handoff requires manual handling @${params.requestedByAgent} -> @${targetAgentKey}: ${intake.error}`
        //> Source statement or expression.
        : intake.error
        //> Source statement or expression.
        ? `Routed handoff queued @${params.requestedByAgent} -> @${targetAgentKey}: ${intake.error}`
        //> Source statement or expression.
        : `Routed handoff @${params.requestedByAgent} -> @${targetAgentKey}: ${handoff.command}`,
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        kind:
          //> Source statement or expression.
          intake.status === "MANUAL_REQUIRED"
            //> Source statement or expression.
            ? "agent_handoff_manual_required"
            //> Source statement or expression.
            : "agent_handoff_routed",
        //> Source statement or expression.
        taskId: routedTask.id,
        //> Source statement or expression.
        targetAgentKey,
        //> Source statement or expression.
        reason: intake.error,
        //> Source statement or expression.
        ...trace
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db
    //> Delimiter or separator.
    );

    //> Source statement or expression.
    routedCount += 1;
  //> Brace or statement terminator.
  }

  //> Return a value.
  return routedCount;
//> Brace or statement terminator.
}

//> Function declaration.
function shortError(e) {
  //> Conditional branch.
  if (!e) return "Unknown error";
  //> Conditional branch.
  if (typeof e === "string") return e;
  //> Conditional branch.
  if (e instanceof Error) return e.message;
  //> Return a value.
  return String(e);
//> Brace or statement terminator.
}

//> Function declaration.
function trimText(value, maxLen) {
  //> Return a value.
  return String(value || "")
    //> Source statement or expression.
    .replace(/\s+/g, " ")
    //> Source statement or expression.
    .trim()
    //> Source statement or expression.
    .slice(0, maxLen);
//> Brace or statement terminator.
}

//> Function declaration.
function httpFailure(provider, status, responseBody) {
  //> Variable declaration.
  const base = `${provider} HTTP ${status}`;
  //> Variable declaration.
  const suffix = responseBody ? `: ${trimText(responseBody, 600)}` : "";
  //> Conditional branch.
  if (status === 401 || status === 403) {
    //> Return a value.
    return new WorkerTaskError("AUTH_REJECTED", `${base}${suffix}`, false);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (status === 429) {
    //> Return a value.
    return new WorkerTaskError("RATE_LIMITED", `${base}${suffix}`, true);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (status === 408 || status === 504) {
    //> Return a value.
    return new WorkerTaskError("PROVIDER_TIMEOUT", `${base}${suffix}`, true);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (status >= 500) {
    //> Return a value.
    return new WorkerTaskError("PROVIDER_UNAVAILABLE", `${base}${suffix}`, true);
  //> Brace or statement terminator.
  }
  //> Return a value.
  return new WorkerTaskError("PROVIDER_BAD_REQUEST", `${base}${suffix}`, false);
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeFailure(e) {
  //> Conditional branch.
  if (e instanceof WorkerTaskError) {
    //> Return a value.
    return {
      //> Source statement or expression.
      code: e.code || "EXECUTION_ERROR",
      //> Source statement or expression.
      retryable: Boolean(e.retryable),
      //> Source statement or expression.
      kind: e.retryable ? "RETRYABLE" : "NON_RETRYABLE",
      //> Source statement or expression.
      message: shortError(e)
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const message = shortError(e);
  //> Conditional branch.
  if (/timed?\s*out|timeout/i.test(message)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      code: "PROVIDER_TIMEOUT",
      //> Source statement or expression.
      retryable: true,
      //> Source statement or expression.
      kind: "RETRYABLE",
      //> Source statement or expression.
      message
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (/fetch failed|econnrefused|enotfound|network/i.test(message)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      code: "PROVIDER_UNAVAILABLE",
      //> Source statement or expression.
      retryable: true,
      //> Source statement or expression.
      kind: "RETRYABLE",
      //> Source statement or expression.
      message
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    code: "EXECUTION_ERROR",
    //> Source statement or expression.
    retryable: true,
    //> Source statement or expression.
    kind: "RETRYABLE",
    //> Source statement or expression.
    message
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function fetchWithTimeout(url, init, provider, timeoutOverrideMs) {
  //> Variable declaration.
  const timeoutMs = clampInt(timeoutOverrideMs ?? REQUEST_TIMEOUT_MS, 60000, 1000, 300000);
  //> Variable declaration.
  const controller = new AbortController();
  //> Variable declaration.
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  //> Try block start.
  try {
    //> Return a value.
    return await fetch(url, { ...init, signal: controller.signal });
  //> Source statement or expression.
  } catch (e) {
    //> Conditional branch.
    if (e?.name === "AbortError") {
      //> Throw error.
      throw new WorkerTaskError(
        //> String literal line.
        "PROVIDER_TIMEOUT",
        //> String literal line.
        `${provider} request timed out after ${timeoutMs}ms`,
        //> Source statement or expression.
        true
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
    //> Throw error.
    throw new WorkerTaskError(
      //> String literal line.
      "PROVIDER_UNAVAILABLE",
      //> String literal line.
      `${provider} request failed: ${shortError(e)}`,
      //> Source statement or expression.
      true
    //> Delimiter or separator.
    );
  //> Source statement or expression.
  } finally {
    //> Source statement or expression.
    clearTimeout(timer);
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Async function declaration.
async function ghGraphQL(query, variables) {
  //> Conditional branch.
  if (!GITHUB_TOKEN) {
    //> Throw error.
    throw new Error("Missing MVP_FACTORY_CONTROL_GITHUB_TOKEN for board grounding.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const res = await fetch("https://api.github.com/graphql", {
    //> Source statement or expression.
    method: "POST",
    //> Source statement or expression.
    headers: {
      //> Source statement or expression.
      Authorization: `bearer ${GITHUB_TOKEN}`,
      //> String literal line.
      "Content-Type": "application/json"
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    body: JSON.stringify({ query, variables })
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!res.ok) {
    //> Throw error.
    throw new Error(`GitHub GraphQL HTTP ${res.status}`);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const json = await res.json();
  //> Conditional branch.
  if (json.errors?.length) {
    //> Throw error.
    throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
  //> Brace or statement terminator.
  }
  //> Return a value.
  return json.data;
//> Brace or statement terminator.
}

//> Function declaration.
function computeIssueEvidenceBackoffMs(attempt) {
  //> Variable declaration.
  const step = Math.max(attempt - 1, 0);
  //> Variable declaration.
  const raw = Math.min(ISSUE_EVIDENCE_RETRY_BASE_MS * 2 ** step, ISSUE_EVIDENCE_RETRY_MAX_MS);
  //> Variable declaration.
  const jitter = Math.floor(Math.random() * 250);
  //> Return a value.
  return Math.min(raw + jitter, ISSUE_EVIDENCE_RETRY_MAX_MS);
//> Brace or statement terminator.
}

//> Function declaration.
function isTransientIssueEvidenceStatus(status) {
  //> Conditional branch.
  if (status === 408 || status === 425 || status === 429) return true;
  //> Return a value.
  return status >= 500;
//> Brace or statement terminator.
}

//> Function declaration.
function summarizeIssueEvidenceArtifacts(meta) {
  //> Variable declaration.
  const toolCalls = Array.isArray(meta?.toolCalls) ? meta.toolCalls : [];
  //> Conditional branch.
  if (!toolCalls.length) {
    //> Return a value.
    return {
      //> Source statement or expression.
      summary: "none",
      //> Source statement or expression.
      items: []
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const items = toolCalls.slice(0, 8).map((call) => {
    //> Variable declaration.
    const id = normalizeText(call?.id) || "call";
    //> Variable declaration.
    const tool = normalizeText(call?.tool) || "tool";
    //> Variable declaration.
    const exit =
      //> Source statement or expression.
      call?.exitCode == null || Number.isNaN(Number(call.exitCode))
        //> Source statement or expression.
        ? ""
        //> Source statement or expression.
        : ` exit=${Number(call.exitCode)}`;
    //> Variable declaration.
    const artifact = normalizeText(call?.artifactId);
    //> Return a value.
    return `${id}:${tool}${exit}${artifact ? ` artifact=${artifact}` : ""}`;
  //> Brace or statement terminator.
  });
  //> Return a value.
  return {
    //> Source statement or expression.
    summary: items.join("; "),
    //> Source statement or expression.
    items
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function buildIssueEvidenceCommentBody(params) {
  //> Variable declaration.
  const task = params.task || {};
  //> Variable declaration.
  const outcome = normalizeText(params.outcome).toUpperCase() || "UNKNOWN";
  //> Variable declaration.
  const evidenceKey = `${task.id}:${outcome}`;
  //> Variable declaration.
  const summarySource =
    //> Source statement or expression.
    params.resultAnswer || params.failureMessage || task.error || task.title || "no summary";
  //> Variable declaration.
  const summary = trimText(redactSensitiveOutput(summarySource).text, 320);
  //> Variable declaration.
  const artifactSummary = summarizeIssueEvidenceArtifacts(params.resultMeta);
  //> Variable declaration.
  const attempt =
    //> Source statement or expression.
    params.attemptCount == null || Number.isNaN(Number(params.attemptCount))
      //> Source statement or expression.
      ? "n/a"
      //> Source statement or expression.
      : Number(params.attemptCount);
  //> Variable declaration.
  const maxAttempts =
    //> Source statement or expression.
    params.maxAttempts == null || Number.isNaN(Number(params.maxAttempts))
      //> Source statement or expression.
      ? "n/a"
      //> Source statement or expression.
      : Number(params.maxAttempts);
  //> Return a value.
  return [
    //> String literal line.
    `<!-- mvp-factory-control-evidence:${evidenceKey} -->`,
    //> String literal line.
    "MVP Factory Control runtime evidence",
    //> String literal line.
    `- task: \`${task.id}\``,
    //> String literal line.
    `- outcome: \`${outcome}\``,
    //> String literal line.
    `- agent: \`@${task.agentKey}\``,
    //> String literal line.
    `- attempt: \`${attempt}/${maxAttempts}\``,
    //> String literal line.
    `- artifacts: ${artifactSummary.summary}`,
    //> String literal line.
    `- summary: ${summary}`
  //> Source statement or expression.
  ].join("\n");
//> Brace or statement terminator.
}

//> Async function declaration.
async function postGitHubIssueComment(issueNumber, body) {
  //> Variable declaration.
  const response = await fetchWithTimeout(
    //> String literal line.
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues/${issueNumber}/comments`,
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      method: "POST",
      //> Source statement or expression.
      headers: {
        //> Source statement or expression.
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        //> Source statement or expression.
        Accept: "application/vnd.github+json",
        //> String literal line.
        "Content-Type": "application/json",
        //> String literal line.
        "X-GitHub-Api-Version": "2022-11-28"
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      body: JSON.stringify({ body })
    //> Brace or statement terminator.
    },
    //> String literal line.
    "GitHub issue evidence publisher",
    //> Source statement or expression.
    20_000
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const responseText = await response.text();
  //> Variable declaration.
  let json = null;
  //> Try block start.
  try {
    //> Source statement or expression.
    json = responseText ? JSON.parse(responseText) : null;
  //> Source statement or expression.
  } catch {
    //> Source statement or expression.
    json = null;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    ok: response.ok,
    //> Source statement or expression.
    status: response.status,
    //> Source statement or expression.
    json,
    //> Source statement or expression.
    responseText
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function publishRuntimeIssueEvidence(params) {
  //> Variable declaration.
  const task = params?.task;
  //> Variable declaration.
  const outcome = normalizeText(params?.outcome).toUpperCase() || "UNKNOWN";
  //> Conditional branch.
  if (!task?.id) return { posted: false, skipped: true, reason: "TASK_MISSING" };
  //> Variable declaration.
  const evidenceKey = `${task.id}:${outcome}`;
  //> Variable declaration.
  const issueNumber = Number(task.issueNumber);
  //> Variable declaration.
  const metadataBase = {
    //> Source statement or expression.
    taskId: task.id,
    //> Source statement or expression.
    issueNumber: Number.isFinite(issueNumber) ? issueNumber : null,
    //> Source statement or expression.
    outcome,
    //> Source statement or expression.
    evidenceKey
  //> Brace or statement terminator.
  };

  //> Conditional branch.
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK_ISSUE_EVIDENCE",
      //> Source statement or expression.
      entityId: evidenceKey,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "POST_ISSUE_COMMENT",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason: "Issue evidence skipped: task has no linked issue number.",
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        ...metadataBase,
        //> Source statement or expression.
        code: "ISSUE_NUMBER_MISSING"
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Return a value.
    return { posted: false, skipped: true, reason: "ISSUE_NUMBER_MISSING" };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const alreadyPosted = await prisma.lifecycleAuditEvent.findFirst({
    //> Source statement or expression.
    where: {
      //> Source statement or expression.
      entityType: "TASK_ISSUE_EVIDENCE",
      //> Source statement or expression.
      entityId: evidenceKey,
      //> Source statement or expression.
      action: "POST_ISSUE_COMMENT",
      //> Source statement or expression.
      allowed: true
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    select: { id: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (alreadyPosted) {
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK_ISSUE_EVIDENCE",
      //> Source statement or expression.
      entityId: evidenceKey,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "SKIP_ISSUE_COMMENT_DUPLICATE",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: "Issue evidence comment already posted for this task outcome key.",
      //> Source statement or expression.
      metadata: metadataBase
    //> Brace or statement terminator.
    });
    //> Return a value.
    return { posted: false, skipped: true, reason: "DUPLICATE" };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (!GITHUB_TOKEN) {
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK_ISSUE_EVIDENCE",
      //> Source statement or expression.
      entityId: evidenceKey,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "POST_ISSUE_COMMENT",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason: "Issue evidence posting failed: MVP_FACTORY_CONTROL_GITHUB_TOKEN is missing.",
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        ...metadataBase,
        //> Source statement or expression.
        code: "TOKEN_MISSING"
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Return a value.
    return { posted: false, skipped: false, reason: "TOKEN_MISSING" };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const commentBody = buildIssueEvidenceCommentBody({
    //> Source statement or expression.
    task,
    //> Source statement or expression.
    outcome,
    //> Source statement or expression.
    resultMeta: params?.resultMeta,
    //> Source statement or expression.
    resultAnswer: params?.resultAnswer,
    //> Source statement or expression.
    failureMessage: params?.failureMessage,
    //> Source statement or expression.
    attemptCount: params?.attemptCount,
    //> Source statement or expression.
    maxAttempts: params?.maxAttempts
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  let finalErrorReason = "Issue evidence posting failed.";
  //> For-loop header.
  for (let attempt = 1; attempt <= ISSUE_EVIDENCE_MAX_ATTEMPTS; attempt += 1) {
    //> Try block start.
    try {
      //> Variable declaration.
      const posted = await postGitHubIssueComment(issueNumber, commentBody);
      //> Conditional branch.
      if (posted.ok) {
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK_ISSUE_EVIDENCE",
          //> Source statement or expression.
          entityId: evidenceKey,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "POST_ISSUE_COMMENT",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: "Issue evidence comment posted successfully.",
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            ...metadataBase,
            //> Source statement or expression.
            attempt,
            //> Source statement or expression.
            commentId: posted.json?.id || null,
            //> Source statement or expression.
            commentUrl: posted.json?.html_url || null
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Return a value.
        return { posted: true, skipped: false, reason: null };
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const bodyText = trimText(redactSensitiveOutput(posted.responseText).text, 500);
      //> Variable declaration.
      const transient = isTransientIssueEvidenceStatus(posted.status);
      //> Source statement or expression.
      finalErrorReason = `Issue evidence comment HTTP ${posted.status}${
        //> Source statement or expression.
        bodyText ? `: ${bodyText}` : ""
      //> Source statement or expression.
      }`;
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK_ISSUE_EVIDENCE",
        //> Source statement or expression.
        entityId: evidenceKey,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "POST_ISSUE_COMMENT_ATTEMPT",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: task.status,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: finalErrorReason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          ...metadataBase,
          //> Source statement or expression.
          attempt,
          //> Source statement or expression.
          status: posted.status,
          //> Source statement or expression.
          transient
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Conditional branch.
      if (!transient || attempt >= ISSUE_EVIDENCE_MAX_ATTEMPTS) break;
      //> Await async value.
      await sleep(computeIssueEvidenceBackoffMs(attempt));
      //> Source statement or expression.
      continue;
    //> Source statement or expression.
    } catch (error) {
      //> Variable declaration.
      const normalized = normalizeFailure(error);
      //> Variable declaration.
      const transient = normalized.retryable;
      //> Source statement or expression.
      finalErrorReason = `Issue evidence posting error: ${normalized.message}`;
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK_ISSUE_EVIDENCE",
        //> Source statement or expression.
        entityId: evidenceKey,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "POST_ISSUE_COMMENT_ATTEMPT",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: task.status,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: finalErrorReason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          ...metadataBase,
          //> Source statement or expression.
          attempt,
          //> Source statement or expression.
          code: normalized.code,
          //> Source statement or expression.
          transient
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Conditional branch.
      if (!transient || attempt >= ISSUE_EVIDENCE_MAX_ATTEMPTS) break;
      //> Await async value.
      await sleep(computeIssueEvidenceBackoffMs(attempt));
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Await async value.
  await recordLifecycleAudit({
    //> Source statement or expression.
    entityType: "TASK_ISSUE_EVIDENCE",
    //> Source statement or expression.
    entityId: evidenceKey,
    //> Source statement or expression.
    actorRole: "ORCHESTRATOR",
    //> Source statement or expression.
    action: "POST_ISSUE_COMMENT",
    //> Source statement or expression.
    fromState: task.status,
    //> Source statement or expression.
    toState: task.status,
    //> Source statement or expression.
    allowed: false,
    //> Source statement or expression.
    reason: finalErrorReason,
    //> Source statement or expression.
    metadata: {
      //> Source statement or expression.
      ...metadataBase,
      //> Source statement or expression.
      attempts: ISSUE_EVIDENCE_MAX_ATTEMPTS
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
  //> Return a value.
  return { posted: false, skipped: false, reason: finalErrorReason };
//> Brace or statement terminator.
}

//> Async function declaration.
async function getProjectMeta() {
  //> Conditional branch.
  if (cachedProjectMeta) return cachedProjectMeta;
  //> Variable declaration.
  const data = await ghGraphQL(
    //> String literal line.
    `query($owner:String!, $num:Int!) {
      //> Source statement or expression.
      user(login:$owner) {
        //> Source statement or expression.
        projectV2(number:$num) {
          //> Source statement or expression.
          id
          //> Source statement or expression.
          title
          //> Source statement or expression.
          fields(first:50) {
            //> Source statement or expression.
            nodes {
              //> Source statement or expression.
              __typename
              //> Source statement or expression.
              ... on ProjectV2SingleSelectField { id name options { id name } }
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }`,
    //> Source statement or expression.
    { owner: GITHUB_PROJECT_OWNER, num: GITHUB_PROJECT_NUMBER }
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const project = data?.user?.projectV2;
  //> Conditional branch.
  if (!project?.id) throw new Error("Unable to load project metadata.");
  //> Source statement or expression.
  cachedProjectMeta = project;
  //> Return a value.
  return cachedProjectMeta;
//> Brace or statement terminator.
}

//> Function declaration.
function detectProduct(prompt, productOptions) {
  //> Const with function or expression.
  const lower = (prompt || "").toLowerCase();
  //> Variable declaration.
  const found = productOptions.find((p) => lower.includes(p.toLowerCase()));
  //> Return a value.
  return found || null;
//> Brace or statement terminator.
}

//> Async function declaration.
async function listProjectItemsForProduct(product, limit = 200) {
  //> Variable declaration.
  const meta = await getProjectMeta();
  //> Variable declaration.
  const items = [];
  //> Variable declaration.
  let after = null;

  //> While-loop header.
  while (items.length < limit) {
    //> Variable declaration.
    const data = await ghGraphQL(
      //> String literal line.
      `query($projectId:ID!, $after:String) {
        //> Source statement or expression.
        node(id:$projectId) {
          //> Source statement or expression.
          ... on ProjectV2 {
            //> Source statement or expression.
            items(first:50, after:$after) {
              //> Source statement or expression.
              pageInfo { hasNextPage endCursor }
              //> Source statement or expression.
              nodes {
                //> Source statement or expression.
                id
                //> Source statement or expression.
                content {
                  //> Source statement or expression.
                  __typename
                  //> Source statement or expression.
                  ... on Issue { number title url }
                //> Brace or statement terminator.
                }
                //> Source statement or expression.
                fieldValues(first:30) {
                  //> Source statement or expression.
                  nodes {
                    //> Source statement or expression.
                    __typename
                    //> Source statement or expression.
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      //> Source statement or expression.
                      name
                      //> Source statement or expression.
                      field { ... on ProjectV2FieldCommon { name } }
                    //> Brace or statement terminator.
                    }
                  //> Brace or statement terminator.
                  }
                //> Brace or statement terminator.
                }
              //> Brace or statement terminator.
              }
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Source statement or expression.
      }`,
      //> Source statement or expression.
      { projectId: meta.id, after }
    //> Delimiter or separator.
    );

    //> Variable declaration.
    const batch = data?.node?.items?.nodes || [];
    //> For-loop header.
    for (const node of batch) {
      //> Conditional branch.
      if (!node?.content || node.content.__typename !== "Issue") continue;
      //> Variable declaration.
      const fields = {};
      //> For-loop header.
      for (const fv of node.fieldValues?.nodes || []) {
        //> Conditional branch.
        if (
          //> Source statement or expression.
          fv?.__typename === "ProjectV2ItemFieldSingleSelectValue" &&
          //> Source statement or expression.
          fv.field?.name &&
          //> Source statement or expression.
          fv.name
        //> Source statement or expression.
        ) {
          //> Source statement or expression.
          fields[fv.field.name] = fv.name;
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
      //> Conditional branch.
      if (fields.Product !== product) continue;
      //> Source statement or expression.
      items.push({
        //> Source statement or expression.
        number: node.content.number,
        //> Source statement or expression.
        title: node.content.title,
        //> Source statement or expression.
        url: node.content.url,
        //> Source statement or expression.
        fields
      //> Brace or statement terminator.
      });
      //> Conditional branch.
      if (items.length >= limit) break;
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const pageInfo = data?.node?.items?.pageInfo;
    //> Conditional branch.
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) break;
    //> Source statement or expression.
    after = pageInfo.endCursor;
  //> Brace or statement terminator.
  }

  //> Return a value.
  return items;
//> Brace or statement terminator.
}

//> Function declaration.
function countBy(items, field) {
  //> Variable declaration.
  const out = {};
  //> For-loop header.
  for (const it of items) {
    //> Variable declaration.
    const key = it.fields?.[field] || "(unset)";
    //> Source statement or expression.
    out[key] = (out[key] || 0) + 1;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Function declaration.
function topEntries(mapObj, n = 3) {
  //> Return a value.
  return Object.entries(mapObj)
    //> Source statement or expression.
    .sort((a, b) => b[1] - a[1])
    //> Source statement or expression.
    .slice(0, n);
//> Brace or statement terminator.
}

//> Function declaration.
function formatThreeLineStatus(grounding) {
  //> Variable declaration.
  const status = topEntries(grounding.statusCounts, 4)
    //> Source statement or expression.
    .map(([k, v]) => `${k}:${v}`)
    //> Source statement or expression.
    .join(", ");
  //> Variable declaration.
  const priority = topEntries(grounding.priorityCounts, 3)
    //> Source statement or expression.
    .map(([k, v]) => `${k}:${v}`)
    //> Source statement or expression.
    .join(", ");
  //> Variable declaration.
  const owners = topEntries(grounding.agentCounts, 3)
    //> Source statement or expression.
    .map(([k, v]) => `${k}:${v}`)
    //> Source statement or expression.
    .join(", ");
  //> Return a value.
  return [
    //> String literal line.
    `${grounding.product}: ${grounding.total} tasks total. Status => ${status || "n/a"}.`,
    //> String literal line.
    `Priority mix => ${priority || "n/a"}.`,
    //> String literal line.
    `Top owners => ${owners || "n/a"}.`
  //> Source statement or expression.
  ].join("\n");
//> Brace or statement terminator.
}

//> Async function declaration.
async function maybeBuildBoardGrounding(prompt) {
  //> Try block start.
  try {
    //> Variable declaration.
    const meta = await getProjectMeta();
    //> Const with function or expression.
    const productField = (meta.fields?.nodes || []).find(
      //> Source statement or expression.
      (f) => f.__typename === "ProjectV2SingleSelectField" && f.name === "Product"
    //> Delimiter or separator.
    );
    //> Const with function or expression.
    const productOptions = (productField?.options || []).map((o) => o.name);
    //> Conditional branch.
    if (!productOptions.length) return null;

    //> Variable declaration.
    const product = detectProduct(prompt, productOptions);
    //> Conditional branch.
    if (!product) return null;

    //> Variable declaration.
    const items = await listProjectItemsForProduct(product, 200);
    //> Return a value.
    return {
      //> Source statement or expression.
      product,
      //> Source statement or expression.
      total: items.length,
      //> Source statement or expression.
      statusCounts: countBy(items, "Status"),
      //> Source statement or expression.
      priorityCounts: countBy(items, "Priority"),
      //> Source statement or expression.
      agentCounts: countBy(items, "Agent"),
      //> Source statement or expression.
      sampleTitles: items.slice(0, 5).map((i) => `#${i.number} ${i.title}`)
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  } catch (e) {
    // Grounding is best-effort. Worker should continue even if GitHub fetch fails.
    //> Return a value.
    return null;
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function buildGroundingBlock(grounding) {
  //> Return a value.
  return grounding
    //> Source statement or expression.
    ? `\n\nGrounding data from live board:\n${JSON.stringify(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          product: grounding.product,
          //> Source statement or expression.
          total: grounding.total,
          //> Source statement or expression.
          statusCounts: grounding.statusCounts,
          //> Source statement or expression.
          priorityCounts: grounding.priorityCounts,
          //> Source statement or expression.
          agentCounts: grounding.agentCounts,
          //> Source statement or expression.
          sampleTitles: grounding.sampleTitles
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        null,
        //> Source statement or expression.
        2
      //> Source statement or expression.
      )}`
    //> Source statement or expression.
    : "";
//> Brace or statement terminator.
}

//> Async function declaration.
async function runLocalRuntime(task, config, promptOverride = null) {
  //> Conditional branch.
  if (!config.model) {
    //> Throw error.
    throw new WorkerTaskError("CONFIG_MISSING", `No model configured for @${task.agentKey}.`, false);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const userPrompt = normalizeText(promptOverride) || task.title;
  //> Variable declaration.
  const grounding = await maybeBuildBoardGrounding(userPrompt);

  //> Conditional branch.
  if (grounding && /status/i.test(userPrompt) && /3[- ]?line/i.test(userPrompt)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      answer: formatThreeLineStatus(grounding),
      //> Source statement or expression.
      meta: {
        //> Source statement or expression.
        provider: "grounded-summary",
        //> Source statement or expression.
        source: "github-project-v2",
        //> Source statement or expression.
        product: grounding.product,
        //> Source statement or expression.
        total: grounding.total
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const startedAt = Date.now();
  //> Variable declaration.
  const groundingBlock = buildGroundingBlock(grounding);

  //> Variable declaration.
  const res = await fetchWithTimeout(
    //> String literal line.
    `${config.endpoint}/api/chat`,
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      method: "POST",
      //> Source statement or expression.
      headers: { "Content-Type": "application/json" },
      //> Source statement or expression.
      body: JSON.stringify({
        //> Source statement or expression.
        model: config.model,
        //> Source statement or expression.
        stream: false,
        //> Source statement or expression.
        messages: [
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            role: "system",
            //> Source statement or expression.
            content:
              //> String literal line.
              `You are ${config.displayName}, a pragmatic coding agent in MVP Factory War Room. Reply with concise, actionable output. If grounding data is provided, use only that data for status claims and explicitly avoid guessing.`
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          { role: "user", content: `${userPrompt}${groundingBlock}` }
        //> Delimiter or separator.
        ]
      //> Delimiter or separator.
      })
    //> Brace or statement terminator.
    },
    //> String literal line.
    "Ollama",
    //> Source statement or expression.
    config.requestTimeoutMs
  //> Delimiter or separator.
  );

  //> Conditional branch.
  if (!res.ok) {
    //> Variable declaration.
    const txt = await res.text();
    //> Throw error.
    throw httpFailure("Ollama", res.status, txt);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const data = await res.json();
  //> Variable declaration.
  const content = data?.message?.content || data?.response || "";
  //> Variable declaration.
  const answer = String(content || "").trim();
  //> Conditional branch.
  if (!answer) {
    //> Throw error.
    throw new WorkerTaskError("EMPTY_RESPONSE", "Ollama returned empty response.", false);
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    answer,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      provider: config.provider,
      //> Source statement or expression.
      baseUrl: config.endpoint,
      //> Source statement or expression.
      model: config.model,
      //> Source statement or expression.
      grounded: Boolean(grounding),
      //> Source statement or expression.
      product: grounding?.product || null,
      //> Source statement or expression.
      durationMs: Date.now() - startedAt,
      //> Source statement or expression.
      doneReason: data?.done_reason || null,
      //> Source statement or expression.
      evalCount: data?.eval_count || null,
      //> Source statement or expression.
      promptEvalCount: data?.prompt_eval_count || null,
      //> Source statement or expression.
      runtimeConfigDigest: config.runtimeConfigDigest || null
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runCloudRuntime(task, config, promptOverride = null) {
  //> Conditional branch.
  if (!config.apiKey) {
    //> Throw error.
    throw new WorkerTaskError(
      //> String literal line.
      "AUTH_MISSING",
      //> String literal line.
      `API key missing for @${task.agentKey}. Set env ${config.apiKeyEnv}.`,
      //> Source statement or expression.
      false
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!config.model) {
    //> Throw error.
    throw new WorkerTaskError("CONFIG_MISSING", `No model configured for @${task.agentKey}.`, false);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const userPrompt = normalizeText(promptOverride) || task.title;
  //> Variable declaration.
  const grounding = await maybeBuildBoardGrounding(userPrompt);

  //> Conditional branch.
  if (grounding && /status/i.test(userPrompt) && /3[- ]?line/i.test(userPrompt)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      answer: formatThreeLineStatus(grounding),
      //> Source statement or expression.
      meta: {
        //> Source statement or expression.
        provider: "grounded-summary",
        //> Source statement or expression.
        source: "github-project-v2",
        //> Source statement or expression.
        product: grounding.product,
        //> Source statement or expression.
        total: grounding.total,
        //> Source statement or expression.
        model: config.model
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const groundingBlock = buildGroundingBlock(grounding);

  //> Variable declaration.
  const startedAt = Date.now();
  //> Variable declaration.
  const res = await fetchWithTimeout(
    //> String literal line.
    `${config.endpoint}/chat/completions`,
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      method: "POST",
      //> Source statement or expression.
      headers: {
        //> Source statement or expression.
        Authorization: `Bearer ${config.apiKey}`,
        //> String literal line.
        "Content-Type": "application/json"
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      body: JSON.stringify({
        //> Source statement or expression.
        model: config.model,
        //> Source statement or expression.
        temperature: 0.2,
        //> Source statement or expression.
        messages: [
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            role: "system",
            //> Source statement or expression.
            content:
              //> String literal line.
              `You are ${config.displayName}, a pragmatic operations agent in MVP Factory War Room. Be concise and actionable. If grounding data is provided, use only that data for status claims and do not guess.`
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          { role: "user", content: `${userPrompt}${groundingBlock}` }
        //> Delimiter or separator.
        ]
      //> Delimiter or separator.
      })
    //> Brace or statement terminator.
    },
    //> String literal line.
    "OpenAI-compatible",
    //> Source statement or expression.
    config.requestTimeoutMs
  //> Delimiter or separator.
  );

  //> Conditional branch.
  if (!res.ok) {
    //> Variable declaration.
    const txt = await res.text();
    //> Throw error.
    throw httpFailure("OpenAI-compatible", res.status, txt);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const data = await res.json();
  //> Variable declaration.
  const raw = data?.choices?.[0]?.message?.content;
  //> Variable declaration.
  const answer =
    //> Source statement or expression.
    typeof raw === "string"
      //> Source statement or expression.
      ? raw.trim()
      //> Source statement or expression.
      : Array.isArray(raw)
      //> Source statement or expression.
      ? raw
          //> Source statement or expression.
          .map((p) => (typeof p?.text === "string" ? p.text : ""))
          //> Source statement or expression.
          .join("")
          //> Source statement or expression.
          .trim()
      //> Source statement or expression.
      : "";
  //> Conditional branch.
  if (!answer) {
    //> Throw error.
    throw new WorkerTaskError("EMPTY_RESPONSE", "OpenAI returned empty response.", false);
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    answer,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      provider: config.provider,
      //> Source statement or expression.
      baseUrl: config.endpoint,
      //> Source statement or expression.
      model: config.model,
      //> Source statement or expression.
      grounded: Boolean(grounding),
      //> Source statement or expression.
      product: grounding?.product || null,
      //> Source statement or expression.
      durationMs: Date.now() - startedAt,
      //> Source statement or expression.
      promptTokens: data?.usage?.prompt_tokens || null,
      //> Source statement or expression.
      completionTokens: data?.usage?.completion_tokens || null,
      //> Source statement or expression.
      totalTokens: data?.usage?.total_tokens || null,
      //> Source statement or expression.
      runtimeConfigDigest: config.runtimeConfigDigest || null
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function readToolPromptFromCallArgs(call) {
  //> Variable declaration.
  const args = asRecord(call?.args);
  //> Conditional branch.
  if (!args) return "";
  //> Variable declaration.
  const prompt = normalizeText(args.prompt);
  //> Conditional branch.
  if (prompt) return prompt;
  //> Variable declaration.
  const command = normalizeText(args.command);
  //> Conditional branch.
  if (command) return command;
  //> Variable declaration.
  const input = normalizeText(args.input);
  //> Conditional branch.
  if (input) return input;
  //> Return a value.
  return "";
//> Brace or statement terminator.
}

//> Async function declaration.
async function executeToolCallProtocol(task, config, envelope, policyEvaluation, dryRun) {
  //> Variable declaration.
  const responses = [];
  //> Variable declaration.
  const callMeta = [];
  //> Variable declaration.
  const policyByCallId = new Map(
    //> Source statement or expression.
    (policyEvaluation.decisions || []).map((decision) => [decision.callId, decision])
  //> Delimiter or separator.
  );
  //> Variable declaration.
  let filesystemContext = null;
  //> Variable declaration.
  let gitContext = null;
  //> Variable declaration.
  let shellContext = null;

  //> Async function declaration.
  async function ensureWorkspaceContext() {
    //> Conditional branch.
    if (!filesystemContext) {
      //> Source statement or expression.
      filesystemContext = await resolveFilesystemToolContext({
        //> Source statement or expression.
        settingsFile: SETTINGS_FILE,
        //> Source statement or expression.
        cwd: process.cwd(),
        //> Source statement or expression.
        env: process.env
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
    //> Return a value.
    return filesystemContext;
  //> Brace or statement terminator.
  }

  //> Async function declaration.
  async function ensureGitContext() {
    //> Conditional branch.
    if (!gitContext) {
      //> Variable declaration.
      const workspaceContext = await ensureWorkspaceContext();
      //> Source statement or expression.
      gitContext = await resolveGitToolContext({
        //> Source statement or expression.
        workspaceRoots: workspaceContext.workspaceRoots,
        //> Source statement or expression.
        primaryWorkspaceRoot: workspaceContext.primaryWorkspaceRoot,
        //> Source statement or expression.
        env: process.env
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
    //> Return a value.
    return gitContext;
  //> Brace or statement terminator.
  }

  //> For-loop header.
  for (let index = 0; index < envelope.calls.length; index += 1) {
    //> Variable declaration.
    const call = envelope.calls[index];
    //> Variable declaration.
    const callPrefix = `tool-call ${call.id} (${call.tool})`;
    //> Variable declaration.
    const policyDecision = policyByCallId.get(call.id) || null;
    //> Conditional branch.
    if (!policyDecision || !policyDecision.allowed) {
      //> Variable declaration.
      const reason =
        //> Source statement or expression.
        policyDecision?.reason || `${callPrefix} denied: no allow policy decision is available.`;
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: task.status,
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          callId: call.id,
          //> Source statement or expression.
          tool: call.tool,
          //> Source statement or expression.
          riskClass: call.riskClass,
          //> Source statement or expression.
          approval: call.approval
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Throw error.
      throw new WorkerTaskError("TOOL_CALL_POLICY_DENIED", reason, false);
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (dryRun) {
      //> Variable declaration.
      const reason = `${callPrefix} dry-run accepted: execution skipped by policy flag.`;
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: task.status,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          callId: call.id,
          //> Source statement or expression.
          tool: call.tool,
          //> Source statement or expression.
          riskClass: call.riskClass,
          //> Source statement or expression.
          approval: call.approval,
          //> Source statement or expression.
          policyClass: policyDecision.policyClass,
          //> Source statement or expression.
          dryRun: true
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Source statement or expression.
      responses.push(
        //> String literal line.
        `[dry-run ${call.id}] ${call.tool} blocked from execution; policy class=${policyDecision.policyClass}.`
      //> Delimiter or separator.
      );
      //> Source statement or expression.
      callMeta.push({
        //> Source statement or expression.
        id: call.id,
        //> Source statement or expression.
        tool: call.tool,
        //> Source statement or expression.
        dryRun: true,
        //> Source statement or expression.
        policyClass: policyDecision.policyClass
      //> Brace or statement terminator.
      });
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (call.tool.startsWith("git.")) {
      //> Variable declaration.
      const resolvedGitContext = await ensureGitContext();
      //> Try block start.
      try {
        //> Variable declaration.
        const gitResult = await executeGitToolCall(call, resolvedGitContext);
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_GIT_INVOKE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: `${callPrefix} git operation executed.`,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            ...(gitResult.audit || {})
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_CALL_PROTOCOL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: `${callPrefix} executed.`,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            dryRun: false
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });

        //> Source statement or expression.
        responses.push(
          //> Source statement or expression.
          envelope.calls.length === 1 ? gitResult.answer : `[${call.id}] ${gitResult.answer}`
        //> Delimiter or separator.
        );
        //> Source statement or expression.
        callMeta.push({
          //> Source statement or expression.
          id: call.id,
          //> Source statement or expression.
          tool: call.tool,
          //> Source statement or expression.
          policyClass: policyDecision.policyClass,
          //> Source statement or expression.
          repoRoot: gitResult.audit?.repoRoot || null,
          //> Source statement or expression.
          branch: gitResult.audit?.branch || null,
          //> Source statement or expression.
          prNumber: gitResult.audit?.prNumber || null
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        continue;
      //> Source statement or expression.
      } catch (error) {
        //> Variable declaration.
        const reason =
          //> Source statement or expression.
          error instanceof ToolGitError
            //> Source statement or expression.
            ? redactSensitiveOutput(error.message).text
            //> Source statement or expression.
            : `${callPrefix} failed with unexpected git runtime error.`;
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_GIT_INVOKE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            code: error instanceof ToolGitError ? error.code : "UNKNOWN",
            //> Source statement or expression.
            details: error instanceof ToolGitError ? sanitizeShellMetadata(error.metadata) : null
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_CALL_PROTOCOL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            dryRun: false,
            //> Source statement or expression.
            code: error instanceof ToolGitError ? error.code : "UNKNOWN"
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Throw error.
        throw new WorkerTaskError("TOOL_GIT_DENIED", reason, false);
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (call.tool === "shell.exec") {
      //> Variable declaration.
      const workspaceContext = await ensureWorkspaceContext();
      //> Conditional branch.
      if (!shellContext) {
        //> Source statement or expression.
        shellContext = await resolveShellToolContext({
          //> Source statement or expression.
          sessionId: `task-${task.id}`,
          //> Source statement or expression.
          workspaceRoots: workspaceContext.workspaceRoots,
          //> Source statement or expression.
          defaultCwd: workspaceContext.primaryWorkspaceRoot,
          //> Source statement or expression.
          env: process.env
        //> Brace or statement terminator.
        });
      //> Brace or statement terminator.
      }
      //> Variable declaration.
      const artifactId = `${task.id}:${call.id}:${Date.now().toString(36)}`;
      //> Variable declaration.
      const streamState = {
        //> Source statement or expression.
        queue: Promise.resolve(),
        //> Source statement or expression.
        pendingBuffer: "",
        //> Source statement or expression.
        pendingRedacted: false,
        //> Source statement or expression.
        pendingStreams: new Set(),
        //> Source statement or expression.
        streamSequence: 0
      //> Brace or statement terminator.
      };
      //> Variable declaration.
      const artifactState = {
        //> Source statement or expression.
        id: artifactId,
        //> Source statement or expression.
        chunkCount: 0,
        //> Source statement or expression.
        streamMessageCount: 0,
        //> Source statement or expression.
        redactedChunkCount: 0,
        //> Source statement or expression.
        stdoutSnippet: "",
        //> Source statement or expression.
        stderrSnippet: "",
        //> Source statement or expression.
        stdoutSnippetTruncated: false,
        //> Source statement or expression.
        stderrSnippetTruncated: false
      //> Brace or statement terminator.
      };

      //> Const with function or expression.
      const enqueueStreamOp = (op) => {
        //> Source statement or expression.
        streamState.queue = streamState.queue
          //> Source statement or expression.
          .then(() => op())
          //> Source statement or expression.
          .catch((err) => {
            //> Source statement or expression.
            console.warn(
              //> String literal line.
              `[mvp-factory-control-worker] shell stream publish failed task=${task.id} call=${call.id}`,
              //> Source statement or expression.
              shortError(err)
            //> Delimiter or separator.
            );
          //> Brace or statement terminator.
          });
        //> Return a value.
        return streamState.queue;
      //> Brace or statement terminator.
      };

      //> Const with function or expression.
      const flushStreamBuffer = (force = false) => {
        //> Conditional branch.
        if (!streamState.pendingBuffer) return;
        //> Conditional branch.
        if (!force && streamState.pendingBuffer.length < SHELL_STREAM_FLUSH_CHARS) return;
        //> Variable declaration.
        const text = streamState.pendingBuffer.slice(0, SHELL_STREAM_MESSAGE_MAX_CHARS);
        //> Variable declaration.
        const truncated = streamState.pendingBuffer.length > SHELL_STREAM_MESSAGE_MAX_CHARS;
        //> Variable declaration.
        const body = truncated ? `${text}\n[TRUNCATED]` : text;
        //> Variable declaration.
        const redacted = streamState.pendingRedacted;
        //> Variable declaration.
        const streams = Array.from(streamState.pendingStreams);
        //> Variable declaration.
        const seq = streamState.streamSequence + 1;
        //> Source statement or expression.
        streamState.streamSequence = seq;
        //> Source statement or expression.
        streamState.pendingBuffer = "";
        //> Source statement or expression.
        streamState.pendingRedacted = false;
        //> Source statement or expression.
        streamState.pendingStreams = new Set();
        //> Source statement or expression.
        artifactState.streamMessageCount += 1;

        //> Source statement or expression.
        enqueueStreamOp(async () => {
          //> Await async value.
          await postMessage(
            //> Source statement or expression.
            task.threadId,
            //> String literal line.
            "SYSTEM",
            //> Source statement or expression.
            null,
            //> String literal line.
            `[stream ${call.id}#${seq}]\n${body}`,
            //> Brace or statement terminator.
            {
              //> Source statement or expression.
              kind: "worker_tool_stream",
              //> Source statement or expression.
              taskId: task.id,
              //> Source statement or expression.
              callId: call.id,
              //> Source statement or expression.
              artifactId,
              //> Source statement or expression.
              sequence: seq,
              //> Source statement or expression.
              streams,
              //> Source statement or expression.
              redacted,
              //> Source statement or expression.
              truncated
            //> Brace or statement terminator.
            }
          //> Delimiter or separator.
          );
          //> Await async value.
          await recordLifecycleAudit({
            //> Source statement or expression.
            entityType: "TASK_ARTIFACT",
            //> Source statement or expression.
            entityId: artifactId,
            //> Source statement or expression.
            actorRole: "ORCHESTRATOR",
            //> Source statement or expression.
            action: "TOOL_SHELL_STREAM",
            //> Source statement or expression.
            fromState: task.status,
            //> Source statement or expression.
            toState: task.status,
            //> Source statement or expression.
            allowed: true,
            //> Source statement or expression.
            reason: `${callPrefix} streamed output to issue thread.`,
            //> Source statement or expression.
            metadata: {
              //> Source statement or expression.
              taskId: task.id,
              //> Source statement or expression.
              callId: call.id,
              //> Source statement or expression.
              sequence: seq,
              //> Source statement or expression.
              streams,
              //> Source statement or expression.
              redacted,
              //> Source statement or expression.
              truncated,
              //> Source statement or expression.
              chars: body.length
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          });
        //> Brace or statement terminator.
        });
      //> Brace or statement terminator.
      };

      //> Try block start.
      try {
        //> Variable declaration.
        const shellResult = await executeShellToolCall(call, shellContext, {
          //> Source statement or expression.
          onOutput: (event) => {
            //> Variable declaration.
            const streamName = normalizeText(event?.stream).toLowerCase() || "stdout";
            //> Variable declaration.
            const safe = redactSensitiveOutput(event?.text || "");
            //> Variable declaration.
            const boundedChunk = appendBoundedText("", safe.text, SHELL_STREAM_MESSAGE_MAX_CHARS);
            //> Variable declaration.
            const chunkBody = boundedChunk.text || "";
            //> Conditional branch.
            if (!chunkBody) return;

            //> Source statement or expression.
            artifactState.chunkCount += 1;
            //> Conditional branch.
            if (safe.redacted) artifactState.redactedChunkCount += 1;
            //> Conditional branch.
            if (streamName === "stderr") {
              //> Variable declaration.
              const next = appendBoundedText(
                //> Source statement or expression.
                artifactState.stderrSnippet,
                //> Source statement or expression.
                chunkBody,
                //> Source statement or expression.
                SHELL_ARTIFACT_SNIPPET_MAX_CHARS
              //> Delimiter or separator.
              );
              //> Source statement or expression.
              artifactState.stderrSnippet = next.text;
              //> Source statement or expression.
              artifactState.stderrSnippetTruncated =
                //> Source statement or expression.
                artifactState.stderrSnippetTruncated || next.truncated;
            //> Source statement or expression.
            } else {
              //> Variable declaration.
              const next = appendBoundedText(
                //> Source statement or expression.
                artifactState.stdoutSnippet,
                //> Source statement or expression.
                chunkBody,
                //> Source statement or expression.
                SHELL_ARTIFACT_SNIPPET_MAX_CHARS
              //> Delimiter or separator.
              );
              //> Source statement or expression.
              artifactState.stdoutSnippet = next.text;
              //> Source statement or expression.
              artifactState.stdoutSnippetTruncated =
                //> Source statement or expression.
                artifactState.stdoutSnippetTruncated || next.truncated;
            //> Brace or statement terminator.
            }

            //> Source statement or expression.
            streamState.pendingBuffer += `[${streamName}] ${chunkBody}\n`;
            //> Source statement or expression.
            streamState.pendingRedacted =
              //> Source statement or expression.
              streamState.pendingRedacted || safe.redacted || Boolean(event?.truncated);
            //> Source statement or expression.
            streamState.pendingStreams.add(streamName);
            //> Source statement or expression.
            flushStreamBuffer(false);
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          shouldCancel: async () => {
            //> Variable declaration.
            const current = await prisma.agentTask.findUnique({
              //> Source statement or expression.
              where: { id: task.id },
              //> Source statement or expression.
              select: { status: true }
            //> Brace or statement terminator.
            });
            //> Return a value.
            return current?.status === "CANCELED";
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        flushStreamBuffer(true);
        //> Await async value.
        await streamState.queue;
        //> Variable declaration.
        const shellAudit = sanitizeShellMetadata(shellResult.audit) || {};
        //> Variable declaration.
        const sanitizedAnswer = redactSensitiveOutput(shellResult.answer).text;

        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_SHELL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: `${callPrefix} shell command executed.`,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            ...shellAudit
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK_ARTIFACT",
          //> Source statement or expression.
          entityId: artifactId,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_SHELL_ARTIFACT",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: `${callPrefix} persisted shell artifact snapshot.`,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            taskId: task.id,
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            artifactId,
            //> Source statement or expression.
            status: "SUCCESS",
            //> Source statement or expression.
            chunkCount: artifactState.chunkCount,
            //> Source statement or expression.
            streamMessageCount: artifactState.streamMessageCount,
            //> Source statement or expression.
            redactedChunkCount: artifactState.redactedChunkCount,
            //> Source statement or expression.
            stdoutSnippet: artifactState.stdoutSnippet || null,
            //> Source statement or expression.
            stderrSnippet: artifactState.stderrSnippet || null,
            //> Source statement or expression.
            stdoutSnippetTruncated: artifactState.stdoutSnippetTruncated,
            //> Source statement or expression.
            stderrSnippetTruncated: artifactState.stderrSnippetTruncated,
            //> Source statement or expression.
            ...shellAudit
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_CALL_PROTOCOL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: `${callPrefix} executed.`,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            dryRun: false
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });

        //> Variable declaration.
        const artifactSummary =
          //> String literal line.
          `artifact=${artifactId} chunks=${artifactState.chunkCount} ` +
          //> String literal line.
          `streamMessages=${artifactState.streamMessageCount} ` +
          //> String literal line.
          `redacted=${artifactState.redactedChunkCount} ` +
          //> String literal line.
          `exit=${shellAudit.exitCode ?? "unknown"}`;
        //> Variable declaration.
        const responseText = `${sanitizedAnswer}\n${artifactSummary}`;
        //> Source statement or expression.
        responses.push(
          //> Source statement or expression.
          envelope.calls.length === 1 ? responseText : `[${call.id}] ${responseText}`
        //> Delimiter or separator.
        );
        //> Source statement or expression.
        callMeta.push({
          //> Source statement or expression.
          id: call.id,
          //> Source statement or expression.
          tool: call.tool,
          //> Source statement or expression.
          policyClass: policyDecision.policyClass,
          //> Source statement or expression.
          sessionId: shellAudit.sessionId || shellContext.sessionId,
          //> Source statement or expression.
          cwd: shellAudit.relativeCwd || ".",
          //> Source statement or expression.
          exitCode: shellAudit.exitCode,
          //> Source statement or expression.
          durationMs: shellAudit.durationMs,
          //> Source statement or expression.
          artifactId,
          //> Source statement or expression.
          streamMessageCount: artifactState.streamMessageCount
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        continue;
      //> Source statement or expression.
      } catch (error) {
        //> Source statement or expression.
        flushStreamBuffer(true);
        //> Await async value.
        await streamState.queue;
        //> Variable declaration.
        const reason =
          //> Source statement or expression.
          error instanceof ToolShellError
            //> Source statement or expression.
            ? error.message
            //> Source statement or expression.
            : `${callPrefix} failed with unexpected shell runtime error.`;
        //> Variable declaration.
        const safeReason = redactSensitiveOutput(reason).text;
        //> Variable declaration.
        const errorDetails =
          //> Source statement or expression.
          error instanceof ToolShellError ? sanitizeShellMetadata(error.metadata) : null;
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK_ARTIFACT",
          //> Source statement or expression.
          entityId: artifactId,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_SHELL_ARTIFACT",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: safeReason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            taskId: task.id,
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            artifactId,
            //> Source statement or expression.
            status: "FAILED",
            //> Source statement or expression.
            chunkCount: artifactState.chunkCount,
            //> Source statement or expression.
            streamMessageCount: artifactState.streamMessageCount,
            //> Source statement or expression.
            redactedChunkCount: artifactState.redactedChunkCount,
            //> Source statement or expression.
            stdoutSnippet: artifactState.stdoutSnippet || null,
            //> Source statement or expression.
            stderrSnippet: artifactState.stderrSnippet || null,
            //> Source statement or expression.
            stdoutSnippetTruncated: artifactState.stdoutSnippetTruncated,
            //> Source statement or expression.
            stderrSnippetTruncated: artifactState.stderrSnippetTruncated,
            //> Source statement or expression.
            code: error instanceof ToolShellError ? error.code : "UNKNOWN",
            //> Source statement or expression.
            details: errorDetails
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_SHELL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: safeReason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            code: error instanceof ToolShellError ? error.code : "UNKNOWN",
            //> Source statement or expression.
            details: errorDetails
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_CALL_PROTOCOL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason: safeReason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            dryRun: false,
            //> Source statement or expression.
            code: error instanceof ToolShellError ? error.code : "UNKNOWN"
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Conditional branch.
        if (error instanceof ToolShellError) {
          //> Conditional branch.
          if (error.code === "TASK_CANCELED") {
            //> Throw error.
            throw new WorkerTaskError("TASK_CANCELED", safeReason, false);
          //> Brace or statement terminator.
          }
          //> Conditional branch.
          if (error.code === "TIMEOUT") {
            //> Throw error.
            throw new WorkerTaskError("TOOL_SHELL_TIMEOUT", safeReason, false);
          //> Brace or statement terminator.
          }
          //> Conditional branch.
          if (error.code === "OUTPUT_LIMIT_EXCEEDED") {
            //> Throw error.
            throw new WorkerTaskError("TOOL_SHELL_OUTPUT_LIMIT", safeReason, false);
          //> Brace or statement terminator.
          }
          //> Conditional branch.
          if (error.code === "EXIT_NON_ZERO") {
            //> Throw error.
            throw new WorkerTaskError("TOOL_SHELL_EXIT_NON_ZERO", safeReason, false);
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
        //> Throw error.
        throw new WorkerTaskError("TOOL_SHELL_DENIED", safeReason, false);
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (call.tool.startsWith("filesystem.")) {
      //> Variable declaration.
      const workspaceContext = await ensureWorkspaceContext();
      //> Try block start.
      try {
        //> Variable declaration.
        const fsResult = await executeFilesystemToolCall(call, workspaceContext);
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_FILESYSTEM_INVOKE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: `${callPrefix} filesystem operation executed.`,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            workspaceRoot: workspaceContext.primaryWorkspaceRoot,
            //> Source statement or expression.
            ...(fsResult.audit || {})
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_CALL_PROTOCOL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: `${callPrefix} executed.`,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            dryRun: false
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        responses.push(envelope.calls.length === 1 ? fsResult.answer : `[${call.id}] ${fsResult.answer}`);
        //> Source statement or expression.
        callMeta.push({
          //> Source statement or expression.
          id: call.id,
          //> Source statement or expression.
          tool: call.tool,
          //> Source statement or expression.
          policyClass: policyDecision.policyClass,
          //> Source statement or expression.
          workspaceRoot: workspaceContext.primaryWorkspaceRoot
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        continue;
      //> Source statement or expression.
      } catch (error) {
        //> Variable declaration.
        const reason =
          //> Source statement or expression.
          error instanceof ToolFilesystemError
            //> Source statement or expression.
            ? error.message
            //> Source statement or expression.
            : `${callPrefix} failed with unexpected filesystem runtime error.`;
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_FILESYSTEM_INVOKE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            code: error instanceof ToolFilesystemError ? error.code : "UNKNOWN",
            //> Source statement or expression.
            details: error instanceof ToolFilesystemError ? error.metadata : null
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit({
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "TOOL_CALL_PROTOCOL_EXECUTE",
          //> Source statement or expression.
          fromState: task.status,
          //> Source statement or expression.
          toState: task.status,
          //> Source statement or expression.
          allowed: false,
          //> Source statement or expression.
          reason,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            callId: call.id,
            //> Source statement or expression.
            tool: call.tool,
            //> Source statement or expression.
            riskClass: call.riskClass,
            //> Source statement or expression.
            approval: call.approval,
            //> Source statement or expression.
            policyClass: policyDecision.policyClass,
            //> Source statement or expression.
            dryRun: false,
            //> Source statement or expression.
            code: error instanceof ToolFilesystemError ? error.code : "UNKNOWN"
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Throw error.
        throw new WorkerTaskError("TOOL_FILESYSTEM_DENIED", reason, false);
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (call.tool !== "chat.respond") {
      //> Variable declaration.
      const reason = `${callPrefix} denied: runtime handler is not enabled for this tool in current phase.`;
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: task.status,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          callId: call.id,
          //> Source statement or expression.
          tool: call.tool,
          //> Source statement or expression.
          riskClass: call.riskClass,
          //> Source statement or expression.
          approval: call.approval,
          //> Source statement or expression.
          policyClass: policyDecision.policyClass
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Throw error.
      throw new WorkerTaskError("TOOL_CALL_UNSUPPORTED", reason, false);
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const prompt = readToolPromptFromCallArgs(call);
    //> Conditional branch.
    if (!prompt) {
      //> Variable declaration.
      const reason =
        //> String literal line.
        `${callPrefix} denied: args.prompt (or args.command/args.input) is required for chat.respond.`;
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "ORCHESTRATOR",
        //> Source statement or expression.
        action: "TOOL_CALL_PROTOCOL_EXECUTE",
        //> Source statement or expression.
        fromState: task.status,
        //> Source statement or expression.
        toState: task.status,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          callId: call.id,
          //> Source statement or expression.
          tool: call.tool,
          //> Source statement or expression.
          riskClass: call.riskClass,
          //> Source statement or expression.
          approval: call.approval,
          //> Source statement or expression.
          policyClass: policyDecision.policyClass
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Throw error.
      throw new WorkerTaskError("TOOL_CALL_INVALID_ARGS", reason, false);
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const runtimeResult =
      //> Source statement or expression.
      task.agent.runtime === "LOCAL"
        //> Source statement or expression.
        ? await runLocalRuntime(task, config, prompt)
        //> Source statement or expression.
        : await runCloudRuntime(task, config, prompt);

    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "TOOL_CALL_PROTOCOL_EXECUTE",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: `${callPrefix} executed.`,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        callId: call.id,
        //> Source statement or expression.
        tool: call.tool,
        //> Source statement or expression.
        riskClass: call.riskClass,
        //> Source statement or expression.
        approval: call.approval,
        //> Source statement or expression.
        policyClass: policyDecision.policyClass,
        //> Source statement or expression.
        dryRun: false
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Source statement or expression.
    responses.push(envelope.calls.length === 1 ? runtimeResult.answer : `[${call.id}] ${runtimeResult.answer}`);
    //> Source statement or expression.
    callMeta.push({
      //> Source statement or expression.
      id: call.id,
      //> Source statement or expression.
      tool: call.tool,
      //> Source statement or expression.
      provider: runtimeResult.meta?.provider || null
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    answer: responses.join("\n\n"),
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      provider: config.provider,
      //> Source statement or expression.
      model: config.model,
      //> Source statement or expression.
      toolCallProtocol: true,
      //> Source statement or expression.
      toolCallProtocolVersion: envelope.version,
      //> Source statement or expression.
      toolCallCount: envelope.calls.length,
      //> Source statement or expression.
      toolCalls: callMeta,
      //> Source statement or expression.
      runtimeConfigDigest: config.runtimeConfigDigest || null
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function executeTask(task) {
  //> Variable declaration.
  const agent = task?.agent;
  //> Conditional branch.
  if (!agent) {
    //> Throw error.
    throw new WorkerTaskError(
      //> String literal line.
      "CONFIG_MISSING",
      //> String literal line.
      `Task ${task?.id || "(unknown)"} is missing agent relation.`,
      //> Source statement or expression.
      false
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const runtimeResolution = readTaskRuntimeConfigResolution(task?.payload);
  //> Conditional branch.
  if (runtimeResolution) {
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "RUNTIME_CONFIG_RESOLUTION",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: "Runtime config resolution applied for execution.",
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        digest: runtimeResolution.digest,
        //> Source statement or expression.
        projectKey: runtimeResolution.projectKey,
        //> Source statement or expression.
        projectName: runtimeResolution.projectName,
        //> Source statement or expression.
        activeContextWindowId: runtimeResolution.activeContextWindowId,
        //> Source statement or expression.
        activeContextOwnerAgentKey: runtimeResolution.activeContextOwnerAgentKey,
        //> Source statement or expression.
        sourceChain: runtimeResolution.sourceChain
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const config = resolveAgentExecutionConfig(agent, runtimeResolution);
  //> Variable declaration.
  const payloadRecord = asRecord(task?.payload);
  //> Variable declaration.
  const toolCallPolicyInput = readTaskToolCallPolicy(payloadRecord);
  //> Variable declaration.
  const toolCallProtocolValidation = validateToolCallProtocolEnvelope(
    //> Source statement or expression.
    payloadRecord?.toolCallProtocol
  //> Delimiter or separator.
  );
  //> Conditional branch.
  if (toolCallProtocolValidation.present) {
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "TOOL_CALL_PROTOCOL_CONSUME",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: toolCallProtocolValidation.ok,
      //> Source statement or expression.
      reason: toolCallProtocolValidation.reason,
      //> Source statement or expression.
      metadata: toolCallProtocolValidation.ok
        //> Source statement or expression.
        ? summarizeToolCallProtocolEnvelope(toolCallProtocolValidation.envelope)
        //> Source statement or expression.
        : { code: toolCallProtocolValidation.code }
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (!toolCallProtocolValidation.ok) {
      //> Throw error.
      throw new WorkerTaskError("TOOL_CALL_INVALID", toolCallProtocolValidation.reason, false);
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const policyEvaluation = evaluateToolCommandPolicy(toolCallProtocolValidation.envelope);
    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "ORCHESTRATOR",
      //> Source statement or expression.
      action: "TOOL_COMMAND_POLICY_EVALUATE",
      //> Source statement or expression.
      fromState: task.status,
      //> Source statement or expression.
      toState: task.status,
      //> Source statement or expression.
      allowed: policyEvaluation.allowed,
      //> Source statement or expression.
      reason:
        //> Source statement or expression.
        policyEvaluation.denyReason ||
        //> Source statement or expression.
        policyEvaluation.approvalReason ||
        //> String literal line.
        "Tool command policy evaluation passed.",
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        approvalTokenPresent: Boolean(readTaskToolCallApprovalToken(payloadRecord)),
        //> Source statement or expression.
        dryRun: toolCallPolicyInput.dryRun,
        //> Source statement or expression.
        ...summarizeToolCommandPolicyEvaluation(policyEvaluation)
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Conditional branch.
    if (!policyEvaluation.allowed) {
      //> Throw error.
      throw new WorkerTaskError(
        //> String literal line.
        "TOOL_CALL_POLICY_DENIED",
        //> Source statement or expression.
        policyEvaluation.denyReason || "Tool command policy denied the action.",
        //> Source statement or expression.
        false
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }

    //> Await async value.
    await verifyAndConsumeToolCallApproval({
      //> Source statement or expression.
      task,
      //> Source statement or expression.
      envelope: toolCallProtocolValidation.envelope,
      //> Source statement or expression.
      policyEvaluation,
      //> Source statement or expression.
      payload: payloadRecord
    //> Brace or statement terminator.
    });

    //> Return a value.
    return executeToolCallProtocol(
      //> Source statement or expression.
      task,
      //> Source statement or expression.
      config,
      //> Source statement or expression.
      toolCallProtocolValidation.envelope,
      //> Source statement or expression.
      policyEvaluation,
      //> Source statement or expression.
      toolCallPolicyInput.dryRun
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (agent.runtime === "LOCAL") {
    //> Return a value.
    return runLocalRuntime(task, config);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (agent.runtime === "CLOUD") {
    //> Return a value.
    return runCloudRuntime(task, config);
  //> Brace or statement terminator.
  }
  //> Throw error.
  throw new WorkerTaskError(
    //> String literal line.
    "CONFIG_MISSING",
    //> String literal line.
    `No runtime executor configured for runtime "${agent.runtime}".`,
    //> Source statement or expression.
    false
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Async function declaration.
async function processTask(task) {
  //> Variable declaration.
  const agentKey = task.agentKey;
  //> Variable declaration.
  const title = task.title;
  //> Variable declaration.
  const { maxAttempts, attemptCount } = normalizeTaskLimits(task);

  //> Await async value.
  await postMessage(
    //> Source statement or expression.
    task.threadId,
    //> String literal line.
    "AGENT",
    //> Source statement or expression.
    agentKey,
    //> String literal line.
    `Ack. Working on: ${title}`,
    //> Source statement or expression.
    { kind: "worker_ack", taskId: task.id }
  //> Delimiter or separator.
  );

  //> Try block start.
  try {
    //> Variable declaration.
    const result = await executeTask(task);

    //> Await async value.
    await withLeaseAuthority(`complete-task:${task.id}`, async (tx) => {
      //> Variable declaration.
      const current = await tx.agentTask.findUnique({
        //> Source statement or expression.
        where: { id: task.id },
        //> Source statement or expression.
        select: { status: true }
      //> Brace or statement terminator.
      });
      //> Conditional branch.
      if (!current) {
        //> Throw error.
        throw new WorkerTaskError(
          //> String literal line.
          "TRANSITION_DENIED",
          //> String literal line.
          `Completion denied: task ${task.id} not found.`,
          //> Source statement or expression.
          false
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      }
      //> Variable declaration.
      const decision = evaluateOrchestratorTaskTransition(
        //> String literal line.
        "COMPLETE_TASK",
        //> Source statement or expression.
        current.status,
        //> String literal line.
        "DONE"
      //> Delimiter or separator.
      );
      //> Conditional branch.
      if (!decision.allowed) {
        //> Await async value.
        await recordLifecycleAudit(
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            entityType: "TASK",
            //> Source statement or expression.
            entityId: task.id,
            //> Source statement or expression.
            actorRole: "ORCHESTRATOR",
            //> Source statement or expression.
            action: "COMPLETE_TASK",
            //> Source statement or expression.
            fromState: current.status,
            //> Source statement or expression.
            toState: "DONE",
            //> Source statement or expression.
            allowed: false,
            //> Source statement or expression.
            reason: decision.reason
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          tx
        //> Delimiter or separator.
        );
        //> Throw error.
        throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const doneMessage = await postMessage(task.threadId, "AGENT", agentKey, result.answer, {
        //> Source statement or expression.
        kind: "worker_done",
        //> Source statement or expression.
        taskId: task.id,
        //> Source statement or expression.
        ...result.meta
      //> Source statement or expression.
      }, tx);

      //> Await async value.
      await routeAgentHandoffs({
        //> Source statement or expression.
        requestedByAgent: agentKey,
        //> Source statement or expression.
        requestedByRole: task.agent?.controlRole || "BETA",
        //> Source statement or expression.
        sourceThreadId: task.threadId,
        //> Source statement or expression.
        sourceMessageId: doneMessage?.id || null,
        //> Source statement or expression.
        sourceContent: result.answer,
        //> Source statement or expression.
        sourceTaskId: task.id,
        //> Source statement or expression.
        sourceTaskTitle: task.title,
        //> Source statement or expression.
        issueNumber: task.issueNumber,
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });

      //> Await async value.
      await tx.agentTask.update({
        //> Source statement or expression.
        where: { id: task.id },
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          status: "DONE",
          //> Source statement or expression.
          finishedAt: new Date(),
          //> Source statement or expression.
          error: null,
          //> Source statement or expression.
          lastFailureCode: null,
          //> Source statement or expression.
          lastFailureKind: null,
          //> Source statement or expression.
          deadLetteredAt: null,
          //> Source statement or expression.
          nextAttemptAt: new Date()
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Await async value.
      await recordLifecycleAudit(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "COMPLETE_TASK",
          //> Source statement or expression.
          fromState: current.status,
          //> Source statement or expression.
          toState: "DONE",
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: decision.reason
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    });
    //> Await async value.
    await publishRuntimeIssueEvidence({
      //> Source statement or expression.
      task,
      //> Source statement or expression.
      outcome: "DONE",
      //> Source statement or expression.
      resultMeta: result.meta,
      //> Source statement or expression.
      resultAnswer: result.answer,
      //> Source statement or expression.
      attemptCount: attemptCount + 1,
      //> Source statement or expression.
      maxAttempts
    //> Brace or statement terminator.
    });
  //> Source statement or expression.
  } catch (e) {
    //> Variable declaration.
    const failure = normalizeFailure(e);
    //> Conditional branch.
    if (failure.code === "LEASE_NOT_HELD" || failure.code === "TRANSITION_DENIED") {
      //> Source statement or expression.
      console.warn(
        //> String literal line.
        `[mvp-factory-control-worker] skipped task completion mutation for ${task.id}: ${failure.message}`
      //> Delimiter or separator.
      );
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const nextAttemptCount = attemptCount + 1;
    //> Conditional branch.
    if (failure.code === "TASK_CANCELED") {
      //> Await async value.
      await withLeaseAuthority(`cancel-task:${task.id}`, async (tx) => {
        //> Variable declaration.
        const current = await tx.agentTask.findUnique({
          //> Source statement or expression.
          where: { id: task.id },
          //> Source statement or expression.
          select: { status: true }
        //> Brace or statement terminator.
        });
        //> Conditional branch.
        if (!current) {
          //> Throw error.
          throw new WorkerTaskError(
            //> String literal line.
            "TRANSITION_DENIED",
            //> String literal line.
            `Cancel denied: task ${task.id} not found.`,
            //> Source statement or expression.
            false
          //> Delimiter or separator.
          );
        //> Brace or statement terminator.
        }
        //> Variable declaration.
        const decision = evaluateOrchestratorTaskTransition(
          //> String literal line.
          "CANCEL_TASK",
          //> Source statement or expression.
          current.status,
          //> String literal line.
          "CANCELED"
        //> Delimiter or separator.
        );
        //> Conditional branch.
        if (!decision.allowed) {
          //> Await async value.
          await recordLifecycleAudit(
            //> Brace or statement terminator.
            {
              //> Source statement or expression.
              entityType: "TASK",
              //> Source statement or expression.
              entityId: task.id,
              //> Source statement or expression.
              actorRole: "ORCHESTRATOR",
              //> Source statement or expression.
              action: "CANCEL_TASK",
              //> Source statement or expression.
              fromState: current.status,
              //> Source statement or expression.
              toState: "CANCELED",
              //> Source statement or expression.
              allowed: false,
              //> Source statement or expression.
              reason: decision.reason
            //> Brace or statement terminator.
            },
            //> Source statement or expression.
            tx
          //> Delimiter or separator.
          );
          //> Throw error.
          throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
        //> Brace or statement terminator.
        }

        //> Await async value.
        await postMessage(
          //> Source statement or expression.
          task.threadId,
          //> String literal line.
          "SYSTEM",
          //> Source statement or expression.
          null,
          //> String literal line.
          `Task canceled for @${agentKey}: ${failure.message} (code=${failure.code}).`,
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            kind: "worker_canceled",
            //> Source statement or expression.
            taskId: task.id,
            //> Source statement or expression.
            error: failure.message,
            //> Source statement or expression.
            ...failureMeta(failure, nextAttemptCount, maxAttempts)
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          tx
        //> Delimiter or separator.
        );
        //> Await async value.
        await tx.agentTask.update({
          //> Source statement or expression.
          where: { id: task.id },
          //> Source statement or expression.
          data: {
            //> Source statement or expression.
            status: "CANCELED",
            //> Source statement or expression.
            attemptCount: nextAttemptCount,
            //> Source statement or expression.
            finishedAt: new Date(),
            //> Source statement or expression.
            error: formatFailureMessage(failure),
            //> Source statement or expression.
            lastFailureCode: failure.code,
            //> Source statement or expression.
            lastFailureKind: failure.kind,
            //> Source statement or expression.
            deadLetteredAt: null,
            //> Source statement or expression.
            nextAttemptAt: new Date()
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit(
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            entityType: "TASK",
            //> Source statement or expression.
            entityId: task.id,
            //> Source statement or expression.
            actorRole: "ORCHESTRATOR",
            //> Source statement or expression.
            action: "CANCEL_TASK",
            //> Source statement or expression.
            fromState: current.status,
            //> Source statement or expression.
            toState: "CANCELED",
            //> Source statement or expression.
            allowed: true,
            //> Source statement or expression.
            reason: decision.reason
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          tx
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      });
      //> Await async value.
      await publishRuntimeIssueEvidence({
        //> Source statement or expression.
        task,
        //> Source statement or expression.
        outcome: "CANCELED",
        //> Source statement or expression.
        failureMessage: failure.message,
        //> Source statement or expression.
        attemptCount: nextAttemptCount,
        //> Source statement or expression.
        maxAttempts
      //> Brace or statement terminator.
      });
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const canRetry = failure.retryable && nextAttemptCount < maxAttempts;
    //> Conditional branch.
    if (canRetry) {
      //> Variable declaration.
      const delayMs = computeRetryDelayMs(nextAttemptCount);
      //> Variable declaration.
      const nextAttemptAt = new Date(Date.now() + delayMs);
      //> Await async value.
      await withLeaseAuthority(`retry-task:${task.id}`, async (tx) => {
        //> Variable declaration.
        const current = await tx.agentTask.findUnique({
          //> Source statement or expression.
          where: { id: task.id },
          //> Source statement or expression.
          select: { status: true }
        //> Brace or statement terminator.
        });
        //> Conditional branch.
        if (!current) {
          //> Throw error.
          throw new WorkerTaskError(
            //> String literal line.
            "TRANSITION_DENIED",
            //> String literal line.
            `Retry denied: task ${task.id} not found.`,
            //> Source statement or expression.
            false
          //> Delimiter or separator.
          );
        //> Brace or statement terminator.
        }
        //> Variable declaration.
        const decision = evaluateOrchestratorTaskTransition(
          //> String literal line.
          "RETRY_TASK",
          //> Source statement or expression.
          current.status,
          //> String literal line.
          "QUEUED"
        //> Delimiter or separator.
        );
        //> Conditional branch.
        if (!decision.allowed) {
          //> Await async value.
          await recordLifecycleAudit(
            //> Brace or statement terminator.
            {
              //> Source statement or expression.
              entityType: "TASK",
              //> Source statement or expression.
              entityId: task.id,
              //> Source statement or expression.
              actorRole: "ORCHESTRATOR",
              //> Source statement or expression.
              action: "RETRY_TASK",
              //> Source statement or expression.
              fromState: current.status,
              //> Source statement or expression.
              toState: "QUEUED",
              //> Source statement or expression.
              allowed: false,
              //> Source statement or expression.
              reason: decision.reason
            //> Brace or statement terminator.
            },
            //> Source statement or expression.
            tx
          //> Delimiter or separator.
          );
          //> Throw error.
          throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
        //> Brace or statement terminator.
        }

        //> Await async value.
        await postMessage(
          //> Source statement or expression.
          task.threadId,
          //> String literal line.
          "SYSTEM",
          //> Source statement or expression.
          null,
          //> String literal line.
          `Task failed for @${agentKey}: ${failure.message} (code=${failure.code}). Retry ${nextAttemptCount}/${maxAttempts} in ${Math.ceil(delayMs / 1000)}s.`,
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            kind: "worker_retry_scheduled",
            //> Source statement or expression.
            taskId: task.id,
            //> Source statement or expression.
            error: failure.message,
            //> Source statement or expression.
            ...failureMeta(failure, nextAttemptCount, maxAttempts),
            //> Source statement or expression.
            nextAttemptAt: nextAttemptAt.toISOString()
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          tx
        //> Delimiter or separator.
        );
        //> Await async value.
        await tx.agentTask.update({
          //> Source statement or expression.
          where: { id: task.id },
          //> Source statement or expression.
          data: {
            //> Source statement or expression.
            status: "QUEUED",
            //> Source statement or expression.
            attemptCount: nextAttemptCount,
            //> Source statement or expression.
            error: formatFailureMessage(failure),
            //> Source statement or expression.
            lastFailureCode: failure.code,
            //> Source statement or expression.
            lastFailureKind: failure.kind,
            //> Source statement or expression.
            nextAttemptAt,
            //> Source statement or expression.
            finishedAt: null
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await recordLifecycleAudit(
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            entityType: "TASK",
            //> Source statement or expression.
            entityId: task.id,
            //> Source statement or expression.
            actorRole: "ORCHESTRATOR",
            //> Source statement or expression.
            action: "RETRY_TASK",
            //> Source statement or expression.
            fromState: current.status,
            //> Source statement or expression.
            toState: "QUEUED",
            //> Source statement or expression.
            allowed: true,
            //> Source statement or expression.
            reason: decision.reason
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          tx
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      });
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }

    //> Await async value.
    await withLeaseAuthority(`dead-letter-task:${task.id}`, async (tx) => {
      //> Variable declaration.
      const current = await tx.agentTask.findUnique({
        //> Source statement or expression.
        where: { id: task.id },
        //> Source statement or expression.
        select: { status: true }
      //> Brace or statement terminator.
      });
      //> Conditional branch.
      if (!current) {
        //> Throw error.
        throw new WorkerTaskError(
          //> String literal line.
          "TRANSITION_DENIED",
          //> String literal line.
          `Dead-letter denied: task ${task.id} not found.`,
          //> Source statement or expression.
          false
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      }
      //> Variable declaration.
      const decision = evaluateOrchestratorTaskTransition(
        //> String literal line.
        "DEAD_LETTER_TASK",
        //> Source statement or expression.
        current.status,
        //> String literal line.
        "DEAD_LETTER"
      //> Delimiter or separator.
      );
      //> Conditional branch.
      if (!decision.allowed) {
        //> Await async value.
        await recordLifecycleAudit(
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            entityType: "TASK",
            //> Source statement or expression.
            entityId: task.id,
            //> Source statement or expression.
            actorRole: "ORCHESTRATOR",
            //> Source statement or expression.
            action: "DEAD_LETTER_TASK",
            //> Source statement or expression.
            fromState: current.status,
            //> Source statement or expression.
            toState: "DEAD_LETTER",
            //> Source statement or expression.
            allowed: false,
            //> Source statement or expression.
            reason: decision.reason
          //> Brace or statement terminator.
          },
          //> Source statement or expression.
          tx
        //> Delimiter or separator.
        );
        //> Throw error.
        throw new WorkerTaskError("TRANSITION_DENIED", decision.reason, false);
      //> Brace or statement terminator.
      }

      //> Await async value.
      await postMessage(
        //> Source statement or expression.
        task.threadId,
        //> String literal line.
        "SYSTEM",
        //> Source statement or expression.
        null,
        //> String literal line.
        `Task moved to dead-letter for @${agentKey}: ${failure.message} (code=${failure.code}, attempts=${nextAttemptCount}/${maxAttempts}).`,
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          kind: "worker_dead_letter",
          //> Source statement or expression.
          taskId: task.id,
          //> Source statement or expression.
          error: failure.message,
          //> Source statement or expression.
          ...failureMeta(failure, nextAttemptCount, maxAttempts)
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
      //> Await async value.
      await tx.agentTask.update({
        //> Source statement or expression.
        where: { id: task.id },
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          status: "DEAD_LETTER",
          //> Source statement or expression.
          attemptCount: nextAttemptCount,
          //> Source statement or expression.
          finishedAt: new Date(),
          //> Source statement or expression.
          deadLetteredAt: new Date(),
          //> Source statement or expression.
          error: formatFailureMessage(failure),
          //> Source statement or expression.
          lastFailureCode: failure.code,
          //> Source statement or expression.
          lastFailureKind: failure.kind
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Await async value.
      await recordLifecycleAudit(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          entityType: "TASK",
          //> Source statement or expression.
          entityId: task.id,
          //> Source statement or expression.
          actorRole: "ORCHESTRATOR",
          //> Source statement or expression.
          action: "DEAD_LETTER_TASK",
          //> Source statement or expression.
          fromState: current.status,
          //> Source statement or expression.
          toState: "DEAD_LETTER",
          //> Source statement or expression.
          allowed: true,
          //> Source statement or expression.
          reason: decision.reason
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
      //> Await async value.
      await recordAlphaFailureEvent(
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          failureClass: "EXECUTION_RETRY_EXHAUSTED",
          //> Source statement or expression.
          issueNumber: task.issueNumber ?? null,
          //> Source statement or expression.
          taskId: task.id,
          //> Source statement or expression.
          threadId: task.threadId || null,
          //> Source statement or expression.
          metadata: {
            //> Source statement or expression.
            agentKey,
            //> Source statement or expression.
            code: failure.code,
            //> Source statement or expression.
            attempts: {
              //> Source statement or expression.
              current: nextAttemptCount,
              //> Source statement or expression.
              max: maxAttempts
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        tx
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    });
    //> Await async value.
    await publishRuntimeIssueEvidence({
      //> Source statement or expression.
      task,
      //> Source statement or expression.
      outcome: "DEAD_LETTER",
      //> Source statement or expression.
      failureMessage: failure.message,
      //> Source statement or expression.
      attemptCount: nextAttemptCount,
      //> Source statement or expression.
      maxAttempts
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function sleep(ms) {
  //> Return a value.
  return new Promise((resolve) => setTimeout(resolve, ms));
//> Brace or statement terminator.
}

//> Function declaration.
function requestShutdown(signal) {
  //> Conditional branch.
  if (isShuttingDown) return;
  //> Source statement or expression.
  isShuttingDown = true;
  //> Source statement or expression.
  console.log(`[mvp-factory-control-worker] received ${signal}; draining loop and releasing lease.`);
//> Brace or statement terminator.
}

//> Source statement or expression.
process.on("SIGINT", () => requestShutdown("SIGINT"));
//> Source statement or expression.
process.on("SIGTERM", () => requestShutdown("SIGTERM"));

//> Async function declaration.
async function loop() {
  //> Conditional branch.
  if (!RAW_AGENT_KEY) {
    //> Throw error.
    throw new Error(
      //> String literal line.
      "MVP_FACTORY_CONTROL_WORKER_AGENT_KEY is required for control-plane worker startup and must reference an ALPHA agent."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Source statement or expression.
  WORKER_AGENT_KEY = await resolveCanonicalAgentKey(RAW_AGENT_KEY);
  //> Variable declaration.
  const roleRow = await prisma.agent.findUnique({
    //> Source statement or expression.
    where: { key: WORKER_AGENT_KEY },
    //> Source statement or expression.
    select: { controlRole: true }
  //> Brace or statement terminator.
  });
  //> Source statement or expression.
  WORKER_CONTROL_ROLE = roleRow?.controlRole || null;
  //> Conditional branch.
  if (WORKER_CONTROL_ROLE !== "ALPHA") {
    //> Throw error.
    throw new Error(
      //> String literal line.
      `Agent @${WORKER_AGENT_KEY} role is ${WORKER_CONTROL_ROLE || "unknown"}. Only ALPHA can run orchestrator worker.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Source statement or expression.
  CLAIM_ALL_TASKS = true;

  //> Await async value.
  await ensureLeaseRow();
  //> Source statement or expression.
  console.log(
    //> String literal line.
    `[mvp-factory-control-worker] started. agent=${WORKER_AGENT_KEY || "ANY"} role=${WORKER_CONTROL_ROLE || "UNSCOPED"} claimScope=${CLAIM_ALL_TASKS ? "ALL" : "FILTERED"} poll=${POLL_MS}ms owner=${ORCHESTRATOR_OWNER_ID} lease=${ORCHESTRATOR_LEASE_ID}`
  //> Delimiter or separator.
  );
  //> Variable declaration.
  let lastRecoveryMs = 0;
  //> For-loop header.
  for (; !isShuttingDown;) {
    //> Try block start.
    try {
      //> Variable declaration.
      const held = await maintainOrchestratorLease("loop-tick");
      //> Await async value.
      await heartbeat(WORKER_AGENT_KEY, {
        //> Source statement or expression.
        leaseId: ORCHESTRATOR_LEASE_ID,
        //> Source statement or expression.
        leaseOwnerId: held ? ORCHESTRATOR_OWNER_ID : null,
        //> Source statement or expression.
        leaseHeld: held
      //> Brace or statement terminator.
      });

      //> Conditional branch.
      if (!held) {
        //> Await async value.
        await sleep(POLL_MS);
        //> Source statement or expression.
        continue;
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const nowMs = Date.now();
      //> Conditional branch.
      if (nowMs - lastRecoveryMs >= Math.max(ORCHESTRATOR_STALE_RUNNING_MS, 5000)) {
        //> Variable declaration.
        const recovered = await recoverStaleRunningTasks();
        //> Conditional branch.
        if (recovered > 0) {
          //> Source statement or expression.
          console.log(`[mvp-factory-control-worker] recovered ${recovered} stale running task(s).`);
        //> Brace or statement terminator.
        }
        //> Source statement or expression.
        lastRecoveryMs = nowMs;
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const task = await claimNextTask(CLAIM_ALL_TASKS ? null : WORKER_AGENT_KEY);
      //> Conditional branch.
      if (!task) {
        //> Await async value.
        await sleep(POLL_MS);
        //> Source statement or expression.
        continue;
      //> Brace or statement terminator.
      }
      //> Source statement or expression.
      console.log(`[mvp-factory-control-worker] claimed ${task.id} agent=${task.agentKey}`);

      //> Variable declaration.
      const renewIntervalMs = Math.max(Math.floor(ORCHESTRATOR_LEASE_TTL_MS / 3), 1000);
      //> Variable declaration.
      const renewTimer = setInterval(() => {
        //> Conditional branch.
        if (isShuttingDown) return;
        //> Source statement or expression.
        void maintainOrchestratorLease("task-heartbeat").catch((err) => {
          //> Source statement or expression.
          console.error("[mvp-factory-control-worker] lease heartbeat failed", err);
        //> Brace or statement terminator.
        });
      //> Source statement or expression.
      }, renewIntervalMs);

      //> Try block start.
      try {
        //> Await async value.
        await processTask(task);
      //> Source statement or expression.
      } finally {
        //> Source statement or expression.
        clearInterval(renewTimer);
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    } catch (e) {
      //> Source statement or expression.
      console.error("[mvp-factory-control-worker] error", e);
      //> Await async value.
      await sleep(POLL_MS);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Source statement or expression.
loop()
  //> Source statement or expression.
  .catch((e) => {
    //> Source statement or expression.
    console.error("[mvp-factory-control-worker] fatal", e);
  //> Delimiter or separator.
  })
  //> Source statement or expression.
  .finally(async () => {
    //> Try block start.
    try {
      //> Await async value.
      await releaseOrchestratorLease("worker-exit");
    //> Source statement or expression.
    } catch (e) {
      //> Source statement or expression.
      console.error("[mvp-factory-control-worker] release failed", e);
    //> Brace or statement terminator.
    }
    //> Await async value.
    await prisma.$disconnect();
  //> Brace or statement terminator.
  });
