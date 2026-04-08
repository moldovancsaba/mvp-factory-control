//> String literal line.
"use server";

/**
 * Issue-scoped server actions: chat messages, task enqueue, GitHub field updates, full alpha context lifecycle, guardrail override.
 */
//> Import bindings from a module.
import { revalidatePath } from "next/cache";
//> Import bindings from a module.
import { getServerSession } from "next-auth";
//> Import bindings from a module.
import { authOptions } from "@/lib/auth";
//> Import bindings from a module.
import { createMessage, getOrCreateThread } from "@/lib/chat";
//> Import bindings from a module.
import { enqueueTask } from "@/lib/tasks";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  consumeContextBudgetForScopeExpansion,
  //> Source statement or expression.
  closeActiveAlphaContextWindow,
  //> Source statement or expression.
  openAndActivateAlphaContextWindow,
  //> Source statement or expression.
  recordActiveContextHandoverPackage,
  //> Source statement or expression.
  setContextGuardrailOverride,
  //> Source statement or expression.
  transferActiveAlphaContextWindow
//> Source statement or expression.
} from "@/lib/alpha-context";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  ensureProjectItemForIssue,
  //> Source statement or expression.
  ensureSingleSelectOption,
  //> Source statement or expression.
  getIssueDetails,
  //> Source statement or expression.
  getItemSingleSelectValues,
  //> Source statement or expression.
  updateSingleSelectField
//> Source statement or expression.
} from "@/lib/github";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  promptPackageMissingSummary,
  //> Source statement or expression.
  validateExecutablePromptPackage
//> Source statement or expression.
} from "@/lib/executable-prompt";
//> Import bindings from a module.
import { resolveRuntimeConfigForTask } from "@/lib/runtime-config";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { getOrchestratorLeaseSnapshot } from "@/lib/orchestrator-lease";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  enqueueManualFallbackTask,
  //> Source statement or expression.
  getAlphaFailureDecision,
  //> Source statement or expression.
  recordAlphaFailureEvent
//> Source statement or expression.
} from "@/lib/alpha-failure-policy";

//> Async function declaration.
async function resolveCanonicalRuntimeAgentKey(input: string) {
  //> Variable declaration.
  const raw = String(input || "").trim();
  //> Conditional branch.
  if (!raw) return null;
  //> Variable declaration.
  const agent = await prisma.agent.findFirst({
    //> Source statement or expression.
    where: {
      //> Source statement or expression.
      key: { equals: raw, mode: "insensitive" },
      //> Source statement or expression.
      runtime: { not: "MANUAL" }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    select: { key: true }
  //> Brace or statement terminator.
  });
  //> Return a value.
  return agent?.key ?? null;
//> Brace or statement terminator.
}

//> Export declaration.
export async function updateIssueFields(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  //> Variable declaration.
  const status = String(formData.get("Status") || "").trim();
  //> Variable declaration.
  const agentInput = String(formData.get("Agent") || "").trim();
  //> Variable declaration.
  const priority = String(formData.get("Priority") || "").trim();
  //> Variable declaration.
  const dod = String(formData.get("DoD") || "").trim();

  //> Conditional branch.
  if (status.toLowerCase() === "ready") {
    //> Variable declaration.
    const issue = await getIssueDetails({ issueNumber });
    //> Variable declaration.
    const promptValidation = validateExecutablePromptPackage(issue.body || "");
    //> Conditional branch.
    if (!promptValidation.valid) {
      //> Throw error.
      throw new Error(promptPackageMissingSummary(promptValidation));
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const { itemId } = await ensureProjectItemForIssue({ issueNumber });

  //> Variable declaration.
  const updates: Array<{ fieldName: string; optionName: string }> = [];
  //> Conditional branch.
  if (status) updates.push({ fieldName: "Status", optionName: status });
  //> Conditional branch.
  if (agentInput) {
    //> Variable declaration.
    const canonicalAgentKey = await resolveCanonicalRuntimeAgentKey(agentInput);
    //> Conditional branch.
    if (!canonicalAgentKey) {
      //> Throw error.
      throw new Error(`Unknown runtime agent key: ${agentInput}`);
    //> Brace or statement terminator.
    }
    //> Await async value.
    await ensureSingleSelectOption({
      //> Source statement or expression.
      fieldName: "Agent",
      //> Source statement or expression.
      optionName: canonicalAgentKey,
      //> Source statement or expression.
      color: "BLUE",
      //> Source statement or expression.
      description: "mvp-factory-control runtime agent key"
    //> Brace or statement terminator.
    });
    //> Source statement or expression.
    updates.push({ fieldName: "Agent", optionName: canonicalAgentKey });
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (priority) updates.push({ fieldName: "Priority", optionName: priority });
  //> Conditional branch.
  if (dod) updates.push({ fieldName: "DoD", optionName: dod });

  //> For-loop header.
  for (const u of updates) {
    //> Await async value.
    await updateSingleSelectField({
      //> Source statement or expression.
      itemId,
      //> Source statement or expression.
      fieldName: u.fieldName,
      //> Source statement or expression.
      optionName: u.optionName
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
  //> Source statement or expression.
  revalidatePath(`/dashboard`);
//> Brace or statement terminator.
}

//> Export declaration.
export async function sendIssueMessage(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;
  //> Variable declaration.
  const content = String(formData.get("content") || "").trim();
  //> Conditional branch.
  if (!content) return;

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });

  //> Await async value.
  await createMessage({
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    userId: userId ?? null,
    //> Source statement or expression.
    authorType: "HUMAN",
    //> Source statement or expression.
    content
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
  //> Source statement or expression.
  revalidatePath("/dashboard");
//> Brace or statement terminator.
}

//> Export declaration.
export async function enqueueIssueTask(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;

  //> Variable declaration.
  const agentInput = String(formData.get("agentKey") || "").trim();
  //> Variable declaration.
  const title = String(formData.get("title") || "").trim();
  //> Conditional branch.
  if (!agentInput) throw new Error("Missing agentKey.");
  //> Conditional branch.
  if (!title) throw new Error("Missing title.");
  //> Variable declaration.
  const agentKey = await resolveCanonicalRuntimeAgentKey(agentInput);
  //> Conditional branch.
  if (!agentKey) {
    //> Throw error.
    throw new Error(`Unknown runtime agent key: ${agentInput}`);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const issue = await getIssueDetails({ issueNumber });
  //> Variable declaration.
  const promptValidation = validateExecutablePromptPackage(issue.body || "");
  //> Conditional branch.
  if (!promptValidation.valid) {
    //> Throw error.
    throw new Error(promptPackageMissingSummary(promptValidation));
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const { itemId } = await ensureProjectItemForIssue({ issueNumber });
  //> Variable declaration.
  const boardFields = await getItemSingleSelectValues({ itemId });
  //> Variable declaration.
  const projectName = String(boardFields["Product"] || "").trim();
  //> Variable declaration.
  const projectKey = projectName ? projectName.toLowerCase() : null;
  //> Variable declaration.
  const runtimeConfigResolution = projectName
    //> Source statement or expression.
    ? await resolveRuntimeConfigForTask({
        //> Source statement or expression.
        projectName,
        //> Source statement or expression.
        agentKey
      //> Delimiter or separator.
      })
    //> Source statement or expression.
    : null;
  //> Conditional branch.
  if (projectName) {
    //> Variable declaration.
    const lease = await getOrchestratorLeaseSnapshot();
    //> Conditional branch.
    if (lease.health === "STALE" || lease.health === "UNHELD") {
      //> Variable declaration.
      const decision = getAlphaFailureDecision("LEASE_AUTHORITY_UNAVAILABLE");
      //> Variable declaration.
      const fallbackReason = `Alpha failure fallback (${decision.failureClass}): ${decision.remediation}`;
      //> Variable declaration.
      const fallbackTask = await enqueueManualFallbackTask({
        //> Source statement or expression.
        agentKey,
        //> Source statement or expression.
        title,
        //> Source statement or expression.
        issueNumber,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        createdById: userId ?? null,
        //> Source statement or expression.
        reason: fallbackReason,
        //> Source statement or expression.
        failureClass: decision.failureClass,
        //> Source statement or expression.
        projectKey,
        //> Source statement or expression.
        projectName,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          leaseHealth: lease.health,
          //> Source statement or expression.
          leaseOwner: lease.ownerId,
          //> Source statement or expression.
          runtimeConfigDigest: runtimeConfigResolution?.digest ?? null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Await async value.
      await recordAlphaFailureEvent({
        //> Source statement or expression.
        failureClass: decision.failureClass,
        //> Source statement or expression.
        projectKey,
        //> Source statement or expression.
        projectName,
        //> Source statement or expression.
        issueNumber,
        //> Source statement or expression.
        taskId: fallbackTask.id,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        leaseHealth: lease.health,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          leaseOwner: lease.ownerId,
          //> Source statement or expression.
          leaseAgent: lease.ownerAgentKey,
          //> Source statement or expression.
          fallbackTaskId: fallbackTask.id
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Await async value.
      await createMessage({
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        authorType: "SYSTEM",
        //> Source statement or expression.
        content: `Fallback applied: ${fallbackReason}`,
        //> Source statement or expression.
        meta: {
          //> Source statement or expression.
          kind: "alpha_failure_fallback",
          //> Source statement or expression.
          failureClass: decision.failureClass,
          //> Source statement or expression.
          fallbackAction: decision.fallbackAction,
          //> Source statement or expression.
          severity: decision.severity,
          //> Source statement or expression.
          remediation: decision.remediation,
          //> Source statement or expression.
          taskId: fallbackTask.id,
          //> Source statement or expression.
          issueNumber,
          //> Source statement or expression.
          projectName
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Source statement or expression.
      revalidatePath(`/issues/${issueNumber}`);
      //> Source statement or expression.
      revalidatePath("/dashboard");
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const guardrail = await consumeContextBudgetForScopeExpansion({
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      actorUserId: userId ?? null,
      //> Source statement or expression.
      sourceAction: "ISSUE_TASK_ENQUEUE",
      //> Source statement or expression.
      incrementPercent: 8,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        issueNumber,
        //> Source statement or expression.
        agentKey,
        //> Source statement or expression.
        title
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Conditional branch.
    if (!guardrail.allowed) {
      //> Variable declaration.
      const decision = getAlphaFailureDecision("CONTEXT_GUARDRAIL_BLOCKED");
      //> Variable declaration.
      const fallbackReason = `Alpha failure fallback (${decision.failureClass}): ${guardrail.reason}`;
      //> Variable declaration.
      const fallbackTask = await enqueueManualFallbackTask({
        //> Source statement or expression.
        agentKey,
        //> Source statement or expression.
        title,
        //> Source statement or expression.
        issueNumber,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        createdById: userId ?? null,
        //> Source statement or expression.
        reason: fallbackReason,
        //> Source statement or expression.
        failureClass: decision.failureClass,
        //> Source statement or expression.
        projectKey,
        //> Source statement or expression.
        projectName,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          usagePercent: guardrail.usagePercent,
          //> Source statement or expression.
          guardrailStatus: guardrail.status,
          //> Source statement or expression.
          contextWindowId: guardrail.activeWindowId,
          //> Source statement or expression.
          runtimeConfigDigest: runtimeConfigResolution?.digest ?? null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Await async value.
      await recordAlphaFailureEvent({
        //> Source statement or expression.
        failureClass: decision.failureClass,
        //> Source statement or expression.
        projectKey,
        //> Source statement or expression.
        projectName,
        //> Source statement or expression.
        issueNumber,
        //> Source statement or expression.
        taskId: fallbackTask.id,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        contextWindowId: guardrail.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          usagePercent: guardrail.usagePercent,
          //> Source statement or expression.
          guardrailStatus: guardrail.status
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Await async value.
      await createMessage({
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        authorType: "SYSTEM",
        //> Source statement or expression.
        content: `Fallback applied: ${fallbackReason}`,
        //> Source statement or expression.
        meta: {
          //> Source statement or expression.
          kind: "alpha_failure_fallback",
          //> Source statement or expression.
          failureClass: decision.failureClass,
          //> Source statement or expression.
          fallbackAction: decision.fallbackAction,
          //> Source statement or expression.
          severity: decision.severity,
          //> Source statement or expression.
          issueNumber,
          //> Source statement or expression.
          projectName,
          //> Source statement or expression.
          taskId: fallbackTask.id,
          //> Source statement or expression.
          usagePercent: guardrail.usagePercent,
          //> Source statement or expression.
          status: guardrail.status,
          //> Source statement or expression.
          remediation: decision.remediation,
          //> Source statement or expression.
          reason: fallbackReason
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Source statement or expression.
      revalidatePath(`/issues/${issueNumber}`);
      //> Source statement or expression.
      revalidatePath("/dashboard");
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (guardrail.status === "WARNING" || guardrail.status === "OVERRIDE_ACTIVE") {
      //> Variable declaration.
      const warningDecision = getAlphaFailureDecision("CONTEXT_GUARDRAIL_WARNING");
      //> Await async value.
      await recordAlphaFailureEvent({
        //> Source statement or expression.
        failureClass: "CONTEXT_GUARDRAIL_WARNING",
        //> Source statement or expression.
        projectKey,
        //> Source statement or expression.
        projectName,
        //> Source statement or expression.
        issueNumber,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        contextWindowId: guardrail.activeWindowId,
        //> Source statement or expression.
        metadata: {
          //> Source statement or expression.
          status: guardrail.status,
          //> Source statement or expression.
          usagePercent: guardrail.usagePercent
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Await async value.
      await createMessage({
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        authorType: "SYSTEM",
        //> Source statement or expression.
        content: `${guardrail.reason} Remediation: ${warningDecision.remediation}`,
        //> Source statement or expression.
        meta: {
          //> Source statement or expression.
          kind: "alpha_context_guardrail_warning",
          //> Source statement or expression.
          issueNumber,
          //> Source statement or expression.
          projectName,
          //> Source statement or expression.
          usagePercent: guardrail.usagePercent,
          //> Source statement or expression.
          status: guardrail.status,
          //> Source statement or expression.
          remediation: warningDecision.remediation
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const task = await enqueueTask({
    //> Source statement or expression.
    agentKey,
    //> Source statement or expression.
    title,
    //> Source statement or expression.
    issueNumber,
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    createdById: userId ?? null,
    //> Source statement or expression.
    payload: { issueNumber },
    //> Source statement or expression.
    runtimeConfigResolution,
    //> Source statement or expression.
    promptPackageSnapshot: {
      //> Source statement or expression.
      sourceKind: "ISSUE_EXECUTABLE_PROMPT",
      //> Source statement or expression.
      sourceRef: issue.url,
      //> Source statement or expression.
      packageBody: issue.body || null,
      //> Source statement or expression.
      packageSections: promptValidation.sections
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Await async value.
  await createMessage({
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    userId: userId ?? null,
    //> Source statement or expression.
    authorType: "SYSTEM",
    //> Source statement or expression.
    content:
      //> Source statement or expression.
      task.status === "MANUAL_REQUIRED"
        //> Source statement or expression.
        ? `Manual required for @${agentKey}: ${task.error || "Agent is not ready for autonomous execution."}`
        //> Source statement or expression.
        : task.error
        //> Source statement or expression.
        ? `Enqueued task for @${agentKey} (pending): ${task.error}`
        //> Source statement or expression.
        : `Enqueued task for @${agentKey}: ${title}`,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      kind: task.status === "MANUAL_REQUIRED" ? "task_manual_required" : "task_enqueued",
      //> Source statement or expression.
      agentKey,
      //> Source statement or expression.
      title,
      //> Source statement or expression.
      issueNumber,
      //> Source statement or expression.
      taskId: task.id,
      //> Source statement or expression.
      reason: task.error || null
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
//> Brace or statement terminator.
}

//> Export declaration.
export async function activateIssueAlphaContextAction(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;
  //> Variable declaration.
  const projectName = String(formData.get("projectName") || "").trim();
  //> Variable declaration.
  const ownerAgentKey = String(formData.get("ownerAgentKey") || "").trim();
  //> Variable declaration.
  const handoverRef = String(formData.get("activationHandoverRef") || "").trim();
  //> Variable declaration.
  const continuityNote = String(formData.get("continuityNote") || "").trim();
  //> Conditional branch.
  if (!projectName) throw new Error("Missing project for Alpha context activation.");
  //> Conditional branch.
  if (!ownerAgentKey) throw new Error("Missing Alpha agent key.");

  //> Variable declaration.
  const result = await openAndActivateAlphaContextWindow({
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    ownerAgentKey,
    //> Source statement or expression.
    actorUserId: userId ?? null,
    //> Source statement or expression.
    activationHandoverRef: handoverRef || null,
    //> Source statement or expression.
    continuityNote: continuityNote || null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });
  //> Await async value.
  await createMessage({
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    authorType: "SYSTEM",
    //> Source statement or expression.
    content: result.ok
      //> Source statement or expression.
      ? `Alpha context lock activated for ${projectName}: @${ownerAgentKey}.`
      //> Source statement or expression.
      : result.reason,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      kind: result.ok ? "alpha_context_activated" : "alpha_context_activation_denied",
      //> Source statement or expression.
      issueNumber,
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      requestedOwnerAgentKey: ownerAgentKey,
      //> Source statement or expression.
      activeWindowId: result.activeWindowId,
      //> Source statement or expression.
      reason: result.reason
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
  //> Source statement or expression.
  revalidatePath("/dashboard");
//> Brace or statement terminator.
}

//> Export declaration.
export async function transferIssueAlphaContextAction(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;
  //> Variable declaration.
  const projectName = String(formData.get("projectName") || "").trim();
  //> Variable declaration.
  const toAgentKey = String(formData.get("toAgentKey") || "").trim();
  //> Variable declaration.
  const handoverRef = String(formData.get("handoverRef") || "").trim();
  //> Variable declaration.
  const continuityNote = String(formData.get("continuityNote") || "").trim();
  //> Conditional branch.
  if (!projectName) throw new Error("Missing project for Alpha context transfer.");
  //> Conditional branch.
  if (!toAgentKey) throw new Error("Missing transfer target Alpha agent key.");

  //> Variable declaration.
  const result = await transferActiveAlphaContextWindow({
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    toAgentKey,
    //> Source statement or expression.
    actorUserId: userId ?? null,
    //> Source statement or expression.
    handoverRef,
    //> Source statement or expression.
    continuityNote: continuityNote || null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });
  //> Await async value.
  await createMessage({
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    authorType: "SYSTEM",
    //> Source statement or expression.
    content: result.ok
      //> Source statement or expression.
      ? `Alpha context lock transferred for ${projectName} to @${toAgentKey}.`
      //> Source statement or expression.
      : result.reason,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      kind: result.ok ? "alpha_context_transferred" : "alpha_context_transfer_denied",
      //> Source statement or expression.
      issueNumber,
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      requestedToAgentKey: toAgentKey,
      //> Source statement or expression.
      activeWindowId: result.activeWindowId,
      //> Source statement or expression.
      handoverRef: handoverRef || null,
      //> Source statement or expression.
      reason: result.reason
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
  //> Source statement or expression.
  revalidatePath("/dashboard");
//> Brace or statement terminator.
}

//> Export declaration.
export async function closeIssueAlphaContextAction(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;
  //> Variable declaration.
  const projectName = String(formData.get("projectName") || "").trim();
  //> Variable declaration.
  const handoverRef = String(formData.get("handoverRef") || "").trim();
  //> Variable declaration.
  const closeReason = String(formData.get("closeReason") || "").trim();
  //> Conditional branch.
  if (!projectName) throw new Error("Missing project for Alpha context close.");

  //> Variable declaration.
  const result = await closeActiveAlphaContextWindow({
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    actorUserId: userId ?? null,
    //> Source statement or expression.
    handoverRef,
    //> Source statement or expression.
    closeReason: closeReason || null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });
  //> Await async value.
  await createMessage({
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    authorType: "SYSTEM",
    //> Source statement or expression.
    content: result.ok
      //> Source statement or expression.
      ? `Alpha context lock closed for ${projectName}.`
      //> Source statement or expression.
      : result.reason,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      kind: result.ok ? "alpha_context_closed" : "alpha_context_close_denied",
      //> Source statement or expression.
      issueNumber,
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      activeWindowId: result.activeWindowId,
      //> Source statement or expression.
      handoverRef: handoverRef || null,
      //> Source statement or expression.
      closeReason: closeReason || null,
      //> Source statement or expression.
      reason: result.reason
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
  //> Source statement or expression.
  revalidatePath("/dashboard");
//> Brace or statement terminator.
}

//> Export declaration.
export async function recordIssueHandoverPackageAction(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;
  //> Variable declaration.
  const projectName = String(formData.get("projectName") || "").trim();
  //> Variable declaration.
  const handoverPackageRef = String(formData.get("handoverPackageRef") || "").trim();
  //> Variable declaration.
  const continuationPromptRef = String(formData.get("continuationPromptRef") || "").trim();
  //> Variable declaration.
  const note = String(formData.get("handoverNote") || "").trim();
  //> Conditional branch.
  if (!projectName) throw new Error("Missing project for handover package update.");

  //> Variable declaration.
  const result = await recordActiveContextHandoverPackage({
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    handoverPackageRef,
    //> Source statement or expression.
    continuationPromptRef,
    //> Source statement or expression.
    note: note || null,
    //> Source statement or expression.
    actorUserId: userId ?? null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });
  //> Await async value.
  await createMessage({
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    authorType: "SYSTEM",
    //> Source statement or expression.
    content: result.ok
      //> Source statement or expression.
      ? `Handover package recorded for ${projectName}.`
      //> Source statement or expression.
      : result.reason,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      kind: result.ok ? "alpha_context_handover_package" : "alpha_context_handover_package_denied",
      //> Source statement or expression.
      issueNumber,
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      activeWindowId: result.activeWindowId,
      //> Source statement or expression.
      handoverPackageRef: handoverPackageRef || null,
      //> Source statement or expression.
      continuationPromptRef: continuationPromptRef || null,
      //> Source statement or expression.
      reason: result.reason
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
  //> Source statement or expression.
  revalidatePath("/dashboard");
//> Brace or statement terminator.
}

//> Export declaration.
export async function overrideIssueGuardrailAction(issueNumber: number, formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;
  //> Variable declaration.
  const projectName = String(formData.get("projectName") || "").trim();
  //> Variable declaration.
  const overrideReason = String(formData.get("overrideReason") || "").trim();
  //> Variable declaration.
  const durationMinutes = Number(formData.get("durationMinutes") || "30");
  //> Conditional branch.
  if (!projectName) throw new Error("Missing project for guardrail override.");

  //> Variable declaration.
  const result = await setContextGuardrailOverride({
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    overrideReason,
    //> Source statement or expression.
    durationMinutes,
    //> Source statement or expression.
    actorUserId: userId ?? null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });
  //> Await async value.
  await createMessage({
    //> Source statement or expression.
    threadId: thread.id,
    //> Source statement or expression.
    authorType: "SYSTEM",
    //> Source statement or expression.
    content: result.ok
      //> Source statement or expression.
      ? `Guardrail override set for ${projectName}.`
      //> Source statement or expression.
      : result.reason,
    //> Source statement or expression.
    meta: {
      //> Source statement or expression.
      kind: result.ok ? "alpha_context_guardrail_override" : "alpha_context_guardrail_override_denied",
      //> Source statement or expression.
      issueNumber,
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      activeWindowId: result.activeWindowId,
      //> Source statement or expression.
      durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 30,
      //> Source statement or expression.
      reason: result.reason
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath(`/issues/${issueNumber}`);
  //> Source statement or expression.
  revalidatePath("/dashboard");
//> Brace or statement terminator.
}
