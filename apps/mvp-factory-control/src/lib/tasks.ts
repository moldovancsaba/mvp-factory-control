/**
 * Task queue orchestration: enqueue work, lifecycle transitions, retries, and prompt-package invariants.
 *
 * Integrates: `lifecycle-policy` (state machine), `judgement-gates` (agent readiness / control role),
 * `tool-call-protocol` + `tool-command-policy` (structured tool envelopes), `settings-store` (taste
 * rubric), `runtime-config` (optional resolution snapshot on enqueue), and Prisma task rows.
 *
 * Environment: `MVP_FACTORY_CONTROL_TASK_MAX_ATTEMPTS` (default 3, clamped 1–10).
 */
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { evaluateTaskTransition, recordLifecycleAudit } from "@/lib/lifecycle-policy";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  CONTROL_INTENT_BETA_REASON,
  //> Source statement or expression.
  evaluateTaskJudgementGate
//> Source statement or expression.
} from "@/lib/judgement-gates";
//> Import bindings from a module.
import { getActiveTasteRubricVersion, readMVPFactoryControlSettings } from "@/lib/settings-store";
//> Import bindings from a module.
import { recordTaskPromptPackageInvariant } from "@/lib/prompt-package-invariants";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  summarizeToolCallProtocolEnvelope,
  //> Source statement or expression.
  validateToolCallProtocolEnvelope
//> Source statement or expression.
} from "@/lib/tool-call-protocol";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  evaluateToolCommandPolicy,
  //> Source statement or expression.
  summarizeToolCommandPolicyEvaluation
//> Source statement or expression.
} from "@/lib/tool-command-policy";
//> Import bindings from a module.
import type { RuntimeConfigResolution } from "@/lib/runtime-config";
//> Variable declaration.
const DEFAULT_MAX_ATTEMPTS = Number(process.env.MVP_FACTORY_CONTROL_TASK_MAX_ATTEMPTS || "3");

//> Function declaration.
function asTrimmed(value: unknown) {
  //> Return a value.
  return typeof value === "string" ? value.trim() : "";
//> Brace or statement terminator.
}

//> Function declaration.
function resolveMaxAttempts() {
  //> Conditional branch.
  if (!Number.isFinite(DEFAULT_MAX_ATTEMPTS)) return 3;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(DEFAULT_MAX_ATTEMPTS), 1), 10);
//> Brace or statement terminator.
}

//> Async function declaration.
async function initialTaskState(agentKey: string, title: string): Promise<{
  //> Source statement or expression.
  status: "QUEUED" | "MANUAL_REQUIRED";
  //> Source statement or expression.
  error: string | null;
  //> Source statement or expression.
  controlBoundaryDenied: boolean;
  //> Source statement or expression.
  judgement: ReturnType<typeof evaluateTaskJudgementGate>;
//> Source statement or expression.
}> {
  //> Variable declaration.
  const agent = await prisma.agent.findUnique({
    //> Source statement or expression.
    where: { key: agentKey },
    //> Source statement or expression.
    select: { enabled: true, runtime: true, readiness: true, controlRole: true }
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const judgement = evaluateTaskJudgementGate({
    //> Source statement or expression.
    agentKey,
    //> Source statement or expression.
    title,
    //> Source statement or expression.
    agent
  //> Brace or statement terminator.
  });
  //> Return a value.
  return {
    //> Source statement or expression.
    status: judgement.status,
    //> Source statement or expression.
    error: judgement.error,
    //> Source statement or expression.
    controlBoundaryDenied: judgement.controlBoundaryDenied,
    //> Source statement or expression.
    judgement
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Type or interface definition.
type EnqueueTaskPromptPackageSnapshot = {
  //> Source statement or expression.
  sourceKind: string;
  //> Source statement or expression.
  sourceRef?: string | null;
  //> Source statement or expression.
  packageBody?: string | null;
  //> Source statement or expression.
  packageSections?: unknown;
//> Brace or statement terminator.
};

//> Function declaration.
function inferPromptPackageSource(
  //> Source statement or expression.
  issueNumber: number | undefined,
  //> Source statement or expression.
  payloadRecord: Record<string, unknown>
//> Source statement or expression.
) {
  //> Conditional branch.
  if (typeof issueNumber === "number" && Number.isFinite(issueNumber)) {
    //> Variable declaration.
    const normalized = Math.trunc(issueNumber);
    //> Return a value.
    return {
      //> Source statement or expression.
      sourceKind: "ISSUE_EXECUTABLE_PROMPT",
      //> Source statement or expression.
      sourceRef: `issue:${normalized}`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const payloadKind = typeof payloadRecord.kind === "string" ? payloadRecord.kind : "";
  //> Conditional branch.
  if (payloadKind === "chat_mention") {
    //> Return a value.
    return { sourceKind: "CHAT_MENTION", sourceRef: "thread:global" };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (payloadKind === "chat_mention_tool_call") {
    //> Return a value.
    return { sourceKind: "CHAT_MENTION_TOOL_CALL", sourceRef: "thread:global" };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (payloadKind === "email_ingress_task") {
    //> Return a value.
    return { sourceKind: "EMAIL_INGRESS", sourceRef: "channel:email" };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (payloadKind === "alpha_failure_fallback") {
    //> Return a value.
    return { sourceKind: "ALPHA_FAILURE_FALLBACK", sourceRef: "policy:alpha_failure" };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { sourceKind: "TASK_INPUT_FALLBACK", sourceRef: null };
//> Brace or statement terminator.
}

//> Export declaration.
export async function enqueueTask(params: {
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
  payload?: unknown;
  //> Source statement or expression.
  promptPackageSnapshot?: EnqueueTaskPromptPackageSnapshot;
  //> Source statement or expression.
  runtimeConfigResolution?: RuntimeConfigResolution | null;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const activeTasteRubric = getActiveTasteRubricVersion(settings);
  //> Variable declaration.
  const payloadRecord: Record<string, unknown> =
    //> Source statement or expression.
    params.payload && typeof params.payload === "object" && !Array.isArray(params.payload)
      //> Source statement or expression.
      ? { ...(params.payload as Record<string, unknown>) }
      //> Source statement or expression.
      : {
          //> Source statement or expression.
          value: params.payload ?? null
        //> Brace or statement terminator.
        };
  //> Source statement or expression.
  payloadRecord.tasteRubricVersion = activeTasteRubric?.version ?? null;
  //> Source statement or expression.
  payloadRecord.tasteRubricOwnerEmail = activeTasteRubric?.ownerEmail ?? null;
  //> Conditional branch.
  if (params.runtimeConfigResolution) {
    //> Source statement or expression.
    payloadRecord.runtimeConfigResolution = params.runtimeConfigResolution;
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const toolCallProtocolValidation = validateToolCallProtocolEnvelope(
    //> Source statement or expression.
    payloadRecord.toolCallProtocol
  //> Delimiter or separator.
  );
  //> Conditional branch.
  if (toolCallProtocolValidation.present && toolCallProtocolValidation.ok) {
    //> Source statement or expression.
    payloadRecord.toolCallProtocol = toolCallProtocolValidation.envelope;
  //> Source statement or expression.
  } else if (toolCallProtocolValidation.present) {
    //> Source statement or expression.
    payloadRecord.toolCallProtocolValidation = {
      //> Source statement or expression.
      status: "DENIED",
      //> Source statement or expression.
      code: toolCallProtocolValidation.code,
      //> Source statement or expression.
      reason: toolCallProtocolValidation.reason
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const toolCallPolicyEvaluation =
    //> Source statement or expression.
    toolCallProtocolValidation.present && toolCallProtocolValidation.ok
      //> Source statement or expression.
      ? evaluateToolCommandPolicy(toolCallProtocolValidation.envelope)
      //> Source statement or expression.
      : null;
  //> Conditional branch.
  if (toolCallPolicyEvaluation) {
    //> Source statement or expression.
    payloadRecord.toolCallPolicyEvaluation = summarizeToolCommandPolicyEvaluation(
      //> Source statement or expression.
      toolCallPolicyEvaluation
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const initial = await initialTaskState(params.agentKey, params.title);
  //> Variable declaration.
  let finalStatus: "QUEUED" | "MANUAL_REQUIRED" = initial.status;
  //> Variable declaration.
  let finalError = initial.error;

  //> Conditional branch.
  if (
    //> Source statement or expression.
    finalStatus !== "MANUAL_REQUIRED" &&
    //> Source statement or expression.
    toolCallProtocolValidation.present &&
    //> Source statement or expression.
    !toolCallProtocolValidation.ok
  //> Source statement or expression.
  ) {
    //> Source statement or expression.
    finalStatus = "MANUAL_REQUIRED";
    //> Source statement or expression.
    finalError = toolCallProtocolValidation.reason;
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (toolCallPolicyEvaluation) {
    //> Conditional branch.
    if (finalStatus !== "MANUAL_REQUIRED" && !toolCallPolicyEvaluation.allowed) {
      //> Source statement or expression.
      finalStatus = "MANUAL_REQUIRED";
      //> Source statement or expression.
      finalError = toolCallPolicyEvaluation.denyReason || "Tool command policy denied the action.";
    //> Source statement or expression.
    } else if (finalStatus !== "MANUAL_REQUIRED" && toolCallPolicyEvaluation.requiresApproval) {
      //> Variable declaration.
      const approvalToken = asTrimmed(payloadRecord.toolCallApprovalToken);
      //> Conditional branch.
      if (!approvalToken) {
        //> Source statement or expression.
        finalStatus = "MANUAL_REQUIRED";
        //> Source statement or expression.
        finalError =
          //> Source statement or expression.
          toolCallPolicyEvaluation.approvalReason ||
          //> String literal line.
          "Tool command policy requires explicit approval token before execution.";
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const maxAttempts = resolveMaxAttempts();
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
      toState: finalStatus
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (!decision.allowed) {
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "ENQUEUE_TASK",
        //> Source statement or expression.
        fromState: null,
        //> Source statement or expression.
        toState: finalStatus,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: decision.reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          agentKey: params.agentKey,
          //> Source statement or expression.
          title: params.title
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });
      //> Throw error.
      throw new Error(decision.reason);
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const task = await tx.agentTask.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        agentKey: params.agentKey,
        //> Source statement or expression.
        status: finalStatus,
        //> Source statement or expression.
        attemptCount: 0,
        //> Source statement or expression.
        maxAttempts,
        //> Source statement or expression.
        nextAttemptAt: new Date(),
        //> Source statement or expression.
        lastFailureCode: null,
        //> Source statement or expression.
        lastFailureKind: null,
        //> Source statement or expression.
        deadLetteredAt: null,
        //> Source statement or expression.
        title: params.title,
        //> Source statement or expression.
        issueNumber: params.issueNumber,
        //> Source statement or expression.
        threadId: params.threadId,
        //> Source statement or expression.
        createdById: params.createdById ?? null,
        //> Source statement or expression.
        error: finalError,
        //> Source statement or expression.
        ...(finalStatus === "MANUAL_REQUIRED" ? { finishedAt: new Date() } : {}),
        //> Source statement or expression.
        payload: payloadRecord as never
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Variable declaration.
    const inferredPromptPackage = inferPromptPackageSource(params.issueNumber, payloadRecord);
    //> Await async value.
    await recordTaskPromptPackageInvariant({
      //> Source statement or expression.
      db: tx,
      //> Source statement or expression.
      taskId: task.id,
      //> Source statement or expression.
      snapshot: {
        //> Source statement or expression.
        sourceKind:
          //> Source statement or expression.
          String(params.promptPackageSnapshot?.sourceKind || "").trim() ||
          //> Source statement or expression.
          inferredPromptPackage.sourceKind,
        //> Source statement or expression.
        sourceRef:
          //> Source statement or expression.
          params.promptPackageSnapshot?.sourceRef ?? inferredPromptPackage.sourceRef ?? null,
        //> Source statement or expression.
        issueNumber: params.issueNumber ?? null,
        //> Source statement or expression.
        promptText: params.title,
        //> Source statement or expression.
        packageBody: params.promptPackageSnapshot?.packageBody ?? null,
        //> Source statement or expression.
        packageSections: params.promptPackageSnapshot?.packageSections ?? null,
        //> Source statement or expression.
        payloadSnapshot: payloadRecord
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Conditional branch.
    if (params.runtimeConfigResolution) {
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "RUNTIME_CONFIG_RESOLUTION",
        //> Source statement or expression.
        fromState: null,
        //> Source statement or expression.
        toState: finalStatus,
        //> Source statement or expression.
        allowed: true,
        //> Source statement or expression.
        reason: "Runtime config resolved for task execution.",
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          digest: params.runtimeConfigResolution.digest,
          //> Source statement or expression.
          projectKey: params.runtimeConfigResolution.projectKey,
          //> Source statement or expression.
          projectName: params.runtimeConfigResolution.projectName,
          //> Source statement or expression.
          activeContextWindowId: params.runtimeConfigResolution.activeContextWindowId,
          //> Source statement or expression.
          activeContextOwnerAgentKey:
            //> Source statement or expression.
            params.runtimeConfigResolution.activeContextOwnerAgentKey,
          //> Source statement or expression.
          sourceChain: params.runtimeConfigResolution.sourceChain,
          //> Source statement or expression.
          resolvedAt: params.runtimeConfigResolution.resolvedAt
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (toolCallProtocolValidation.present) {
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "TOOL_CALL_PROTOCOL_VALIDATE",
        //> Source statement or expression.
        fromState: null,
        //> Source statement or expression.
        toState: finalStatus,
        //> Source statement or expression.
        allowed: toolCallProtocolValidation.ok,
        //> Source statement or expression.
        reason: toolCallProtocolValidation.reason,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          agentKey: params.agentKey,
          //> Source statement or expression.
          issueNumber: params.issueNumber ?? null,
          //> Source statement or expression.
          threadId: params.threadId ?? null,
          //> Source statement or expression.
          ...(toolCallProtocolValidation.ok
            //> Source statement or expression.
            ? summarizeToolCallProtocolEnvelope(toolCallProtocolValidation.envelope)
            //> Source statement or expression.
            : { code: toolCallProtocolValidation.code })
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (toolCallPolicyEvaluation) {
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "TOOL_COMMAND_POLICY_EVALUATE",
        //> Source statement or expression.
        fromState: null,
        //> Source statement or expression.
        toState: finalStatus,
        //> Source statement or expression.
        allowed: toolCallPolicyEvaluation.allowed,
        //> Source statement or expression.
        reason:
          //> Source statement or expression.
          toolCallPolicyEvaluation.denyReason ||
          //> Source statement or expression.
          toolCallPolicyEvaluation.approvalReason ||
          //> String literal line.
          "Tool command policy evaluation passed.",
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          issueNumber: params.issueNumber ?? null,
          //> Source statement or expression.
          threadId: params.threadId ?? null,
          //> Source statement or expression.
          approvalTokenPresent: asTrimmed(payloadRecord.toolCallApprovalToken).length > 0,
          //> Source statement or expression.
          ...summarizeToolCommandPolicyEvaluation(toolCallPolicyEvaluation)
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }

    //> Await async value.
    await recordLifecycleAudit({
      //> Source statement or expression.
      entityType: "TASK",
      //> Source statement or expression.
      entityId: task.id,
      //> Source statement or expression.
      actorRole: "HUMAN_OPERATOR",
      //> Source statement or expression.
      action: "JUDGEMENT_GATE",
      //> Source statement or expression.
      fromState: null,
      //> Source statement or expression.
      toState: finalStatus,
      //> Source statement or expression.
      allowed: initial.judgement.allowed,
      //> Source statement or expression.
      reason: initial.judgement.summary,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        issueNumber: params.issueNumber ?? null,
        //> Source statement or expression.
        threadId: params.threadId ?? null,
        //> Source statement or expression.
        agentKey: params.agentKey,
        //> Source statement or expression.
        decision: initial.judgement.decision,
        //> Source statement or expression.
        policyVersion: initial.judgement.policyVersion,
        //> Source statement or expression.
        checks: initial.judgement.checks,
        //> Source statement or expression.
        tasteRubricVersion: activeTasteRubric?.version ?? null
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db: tx
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
      toState: finalStatus,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: decision.reason,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        agentKey: params.agentKey,
        //> Source statement or expression.
        issueNumber: params.issueNumber ?? null,
        //> Source statement or expression.
        threadId: params.threadId ?? null,
        //> Source statement or expression.
        tasteRubricVersion: activeTasteRubric?.version ?? null
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      db: tx
    //> Brace or statement terminator.
    });

    //> Conditional branch.
    if (initial.controlBoundaryDenied) {
      //> Await async value.
      await recordLifecycleAudit({
        //> Source statement or expression.
        entityType: "TASK",
        //> Source statement or expression.
        entityId: task.id,
        //> Source statement or expression.
        actorRole: "HUMAN_OPERATOR",
        //> Source statement or expression.
        action: "BETA_CONTROL_BOUNDARY",
        //> Source statement or expression.
        fromState: null,
        //> Source statement or expression.
        toState: finalStatus,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: initial.error || CONTROL_INTENT_BETA_REASON,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          agentKey: params.agentKey,
          //> Source statement or expression.
          title: params.title
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        db: tx
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }

    //> Return a value.
    return task;
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function markQueuedTasksManualRequired(agentKey: string, reason: string) {
  //> Return a value.
  return prisma.agentTask.updateMany({
    //> Source statement or expression.
    where: { agentKey, status: "QUEUED" },
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      status: "MANUAL_REQUIRED",
      //> Source statement or expression.
      error: reason,
      //> Source statement or expression.
      finishedAt: new Date()
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function listAgentTasks(params: { agentKey: string; limit?: number }) {
  //> Return a value.
  return prisma.agentTask.findMany({
    //> Source statement or expression.
    where: { agentKey: params.agentKey },
    //> Source statement or expression.
    orderBy: { createdAt: "desc" },
    //> Source statement or expression.
    take: Math.min(Math.max(params.limit ?? 50, 1), 200)
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}
