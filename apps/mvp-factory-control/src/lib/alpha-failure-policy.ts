/**
 * Alpha **failure classification** metadata and event recording (lease, guardrails, stale running, retries).
 *
 * `FAILURE_DECISIONS` holds operator-facing remediation copy; CONTEXT_GUARDRAIL_WARNING text matches
 * `alpha-context` thresholds (warning 60%, block 70%). Persists failure events for analytics and gates.
 */
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { evaluateTaskTransition, recordLifecycleAudit } from "@/lib/lifecycle-policy";
//> Import bindings from a module.
import { recordTaskPromptPackageInvariant } from "@/lib/prompt-package-invariants";
//> Import bindings from a module.
import type { Prisma } from "@prisma/client";

//> Type or interface definition.
type FailureDb = Prisma.TransactionClient | typeof prisma;

//> Export declaration.
export type AlphaFailureClass =
  //> Source statement or expression.
  | "LEASE_AUTHORITY_UNAVAILABLE"
  //> Source statement or expression.
  | "CONTEXT_GUARDRAIL_BLOCKED"
  //> Source statement or expression.
  | "CONTEXT_GUARDRAIL_WARNING"
  //> Source statement or expression.
  | "STALE_RUNNING_DETECTED"
  //> Source statement or expression.
  | "EXECUTION_RETRY_EXHAUSTED";

//> Export declaration.
export type AlphaFailureDecision = {
  //> Source statement or expression.
  failureClass: AlphaFailureClass;
  //> Source statement or expression.
  severity: "LOW" | "MEDIUM" | "HIGH";
  //> Source statement or expression.
  fallbackAction: "ALERT_ONLY" | "MANUAL_REQUIRED" | "REQUEUE" | "DEAD_LETTER";
  //> Source statement or expression.
  remediation: string;
//> Brace or statement terminator.
};

//> Variable declaration.
const FAILURE_DECISIONS: Record<AlphaFailureClass, AlphaFailureDecision> = {
  //> Source statement or expression.
  LEASE_AUTHORITY_UNAVAILABLE: {
    //> Source statement or expression.
    failureClass: "LEASE_AUTHORITY_UNAVAILABLE",
    //> Source statement or expression.
    severity: "HIGH",
    //> Source statement or expression.
    fallbackAction: "MANUAL_REQUIRED",
    //> Source statement or expression.
    remediation:
      //> String literal line.
      "Restore active ALPHA lease ownership (start/recover ALPHA worker) before resuming autonomous queue expansion."
  //> Brace or statement terminator.
  },
  //> Source statement or expression.
  CONTEXT_GUARDRAIL_BLOCKED: {
    //> Source statement or expression.
    failureClass: "CONTEXT_GUARDRAIL_BLOCKED",
    //> Source statement or expression.
    severity: "MEDIUM",
    //> Source statement or expression.
    fallbackAction: "MANUAL_REQUIRED",
    //> Source statement or expression.
    remediation:
      //> String literal line.
      "Record valid handover package + continuation prompt, or set bounded audited override when policy allows."
  //> Brace or statement terminator.
  },
  //> Source statement or expression.
  CONTEXT_GUARDRAIL_WARNING: {
    //> Source statement or expression.
    failureClass: "CONTEXT_GUARDRAIL_WARNING",
    //> Source statement or expression.
    severity: "LOW",
    //> Source statement or expression.
    fallbackAction: "ALERT_ONLY",
    //> Source statement or expression.
    remediation:
      //> String literal line.
      "Prepare handover package now; WARNING begins at 60% usage and hard BLOCK without a package applies from 70% (see alpha-context guardrail thresholds)."
  //> Brace or statement terminator.
  },
  //> Source statement or expression.
  STALE_RUNNING_DETECTED: {
    //> Source statement or expression.
    failureClass: "STALE_RUNNING_DETECTED",
    //> Source statement or expression.
    severity: "MEDIUM",
    //> Source statement or expression.
    fallbackAction: "REQUEUE",
    //> Source statement or expression.
    remediation:
      //> String literal line.
      "Inspect stale-running task owner and verify orchestrator recovery path before retrying."
  //> Brace or statement terminator.
  },
  //> Source statement or expression.
  EXECUTION_RETRY_EXHAUSTED: {
    //> Source statement or expression.
    failureClass: "EXECUTION_RETRY_EXHAUSTED",
    //> Source statement or expression.
    severity: "HIGH",
    //> Source statement or expression.
    fallbackAction: "DEAD_LETTER",
    //> Source statement or expression.
    remediation:
      //> String literal line.
      "Review dead-letter diagnostics and convert to manual-required remediation task when needed."
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
};

//> Export declaration.
export function getAlphaFailureDecision(failureClass: AlphaFailureClass): AlphaFailureDecision {
  //> Return a value.
  return FAILURE_DECISIONS[failureClass];
//> Brace or statement terminator.
}

//> Export declaration.
export async function recordAlphaFailureEvent(params: {
  //> Source statement or expression.
  failureClass: AlphaFailureClass;
  //> Source statement or expression.
  projectKey?: string | null;
  //> Source statement or expression.
  projectName?: string | null;
  //> Source statement or expression.
  issueNumber?: number | null;
  //> Source statement or expression.
  taskId?: string | null;
  //> Source statement or expression.
  threadId?: string | null;
  //> Source statement or expression.
  leaseHealth?: string | null;
  //> Source statement or expression.
  contextWindowId?: string | null;
  //> Source statement or expression.
  metadata?: Prisma.InputJsonValue;
  //> Source statement or expression.
  db?: FailureDb;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const db = params.db ?? prisma;
  //> Variable declaration.
  const decision = getAlphaFailureDecision(params.failureClass);
  //> Return a value.
  return db.alphaFailureEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      failureClass: decision.failureClass,
      //> Source statement or expression.
      severity: decision.severity,
      //> Source statement or expression.
      fallbackAction: decision.fallbackAction,
      //> Source statement or expression.
      projectKey: params.projectKey ?? null,
      //> Source statement or expression.
      projectName: params.projectName ?? null,
      //> Source statement or expression.
      issueNumber: params.issueNumber ?? null,
      //> Source statement or expression.
      taskId: params.taskId ?? null,
      //> Source statement or expression.
      threadId: params.threadId ?? null,
      //> Source statement or expression.
      leaseHealth: params.leaseHealth ?? null,
      //> Source statement or expression.
      contextWindowId: params.contextWindowId ?? null,
      //> Source statement or expression.
      remediation: decision.remediation,
      //> Source statement or expression.
      metadata: params.metadata
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function enqueueManualFallbackTask(params: {
  //> Source statement or expression.
  agentKey: string;
  //> Source statement or expression.
  title: string;
  //> Source statement or expression.
  issueNumber?: number;
  //> Source statement or expression.
  threadId?: string;
  //> Source statement or expression.
  createdById?: string | null;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  failureClass: AlphaFailureClass;
  //> Source statement or expression.
  projectKey?: string | null;
  //> Source statement or expression.
  projectName?: string | null;
  //> Source statement or expression.
  metadata?: Prisma.InputJsonValue;
//> Source statement or expression.
}) {
  //> Return a value.
  return prisma.$transaction(async (tx) => {
    //> Variable declaration.
    const decision = evaluateTaskTransition({
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "ENQUEUE_TASK",
      //> Source statement or expression.
      fromState: null,
      //> Source statement or expression.
      toState: "MANUAL_REQUIRED"
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (!decision.allowed) {
      //> Throw error.
      throw new Error(`Manual fallback enqueue denied: ${decision.reason}`);
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const task = await tx.agentTask.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        agentKey: params.agentKey,
        //> Source statement or expression.
        status: "MANUAL_REQUIRED",
        //> Source statement or expression.
        title: params.title,
        //> Source statement or expression.
        issueNumber: params.issueNumber,
        //> Source statement or expression.
        threadId: params.threadId,
        //> Source statement or expression.
        createdById: params.createdById ?? null,
        //> Source statement or expression.
        error: params.reason,
        //> Source statement or expression.
        finishedAt: new Date(),
        //> Source statement or expression.
        payload: {
          //> Source statement or expression.
          kind: "alpha_failure_fallback",
          //> Source statement or expression.
          failureClass: params.failureClass,
          //> Source statement or expression.
          fallbackAction: "MANUAL_REQUIRED",
          //> Source statement or expression.
          projectKey: params.projectKey ?? null,
          //> Source statement or expression.
          projectName: params.projectName ?? null,
          //> Source statement or expression.
          ...((params.metadata as Record<string, unknown> | null) || {})
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await recordTaskPromptPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      taskId: task.id,
      //> Source statement or expression.
      snapshot: {
        //> Source statement or expression.
        sourceKind: "ALPHA_FAILURE_FALLBACK",
        //> Source statement or expression.
        sourceRef: `failure:${params.failureClass}`,
        //> Source statement or expression.
        issueNumber: params.issueNumber ?? null,
        //> Source statement or expression.
        promptText: params.title,
        //> Source statement or expression.
        packageBody: params.reason,
        //> Source statement or expression.
        packageSections: {
          //> Source statement or expression.
          failureClass: params.failureClass,
          //> Source statement or expression.
          remediation: getAlphaFailureDecision(params.failureClass).remediation
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        payloadSnapshot: {
          //> Source statement or expression.
          kind: "alpha_failure_fallback",
          //> Source statement or expression.
          failureClass: params.failureClass,
          //> Source statement or expression.
          projectKey: params.projectKey ?? null,
          //> Source statement or expression.
          projectName: params.projectName ?? null,
          //> Source statement or expression.
          ...((params.metadata as Record<string, unknown> | null) || {})
        //> Brace or statement terminator.
        }
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
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "ENQUEUE_TASK",
      //> Source statement or expression.
      fromState: null,
      //> Source statement or expression.
      toState: "MANUAL_REQUIRED",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: `Fallback policy: ${params.failureClass}`,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        fallbackReason: params.reason,
        //> Source statement or expression.
        projectKey: params.projectKey ?? null,
        //> Source statement or expression.
        projectName: params.projectName ?? null
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db: tx
    //> Brace or statement terminator.
    });

    //> Return a value.
    return task;
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}
