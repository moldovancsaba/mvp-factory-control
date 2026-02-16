"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMessage, getOrCreateThread } from "@/lib/chat";
import { enqueueTask } from "@/lib/tasks";
import {
  consumeContextBudgetForScopeExpansion,
  closeActiveAlphaContextWindow,
  openAndActivateAlphaContextWindow,
  recordActiveContextHandoverPackage,
  setContextGuardrailOverride,
  transferActiveAlphaContextWindow
} from "@/lib/alpha-context";
import {
  ensureProjectItemForIssue,
  ensureSingleSelectOption,
  getIssueDetails,
  getItemSingleSelectValues,
  updateSingleSelectField
} from "@/lib/github";
import {
  promptPackageMissingSummary,
  validateExecutablePromptPackage
} from "@/lib/executable-prompt";
import { resolveRuntimeConfigForTask } from "@/lib/runtime-config";
import { prisma } from "@/lib/prisma";
import { getOrchestratorLeaseSnapshot } from "@/lib/orchestrator-lease";
import {
  enqueueManualFallbackTask,
  getAlphaFailureDecision,
  recordAlphaFailureEvent
} from "@/lib/alpha-failure-policy";

async function resolveCanonicalRuntimeAgentKey(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const agent = await prisma.agent.findFirst({
    where: {
      key: { equals: raw, mode: "insensitive" },
      runtime: { not: "MANUAL" }
    },
    select: { key: true }
  });
  return agent?.key ?? null;
}

export async function updateIssueFields(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  const status = String(formData.get("Status") || "").trim();
  const agentInput = String(formData.get("Agent") || "").trim();
  const priority = String(formData.get("Priority") || "").trim();
  const dod = String(formData.get("DoD") || "").trim();

  if (status.toLowerCase() === "ready") {
    const issue = await getIssueDetails({ issueNumber });
    const promptValidation = validateExecutablePromptPackage(issue.body || "");
    if (!promptValidation.valid) {
      throw new Error(promptPackageMissingSummary(promptValidation));
    }
  }

  const { itemId } = await ensureProjectItemForIssue({ issueNumber });

  const updates: Array<{ fieldName: string; optionName: string }> = [];
  if (status) updates.push({ fieldName: "Status", optionName: status });
  if (agentInput) {
    const canonicalAgentKey = await resolveCanonicalRuntimeAgentKey(agentInput);
    if (!canonicalAgentKey) {
      throw new Error(`Unknown runtime agent key: ${agentInput}`);
    }
    await ensureSingleSelectOption({
      fieldName: "Agent",
      optionName: canonicalAgentKey,
      color: "BLUE",
      description: "WarRoom runtime agent key"
    });
    updates.push({ fieldName: "Agent", optionName: canonicalAgentKey });
  }
  if (priority) updates.push({ fieldName: "Priority", optionName: priority });
  if (dod) updates.push({ fieldName: "DoD", optionName: dod });

  for (const u of updates) {
    await updateSingleSelectField({
      itemId,
      fieldName: u.fieldName,
      optionName: u.optionName
    });
  }

  revalidatePath(`/issues/${issueNumber}`);
  revalidatePath(`/dashboard`);
}

export async function sendIssueMessage(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;
  const content = String(formData.get("content") || "").trim();
  if (!content) return;

  const thread = await getOrCreateThread({
    kind: "ISSUE",
    ref: String(issueNumber),
    title: `Issue #${issueNumber}`,
    createdById: userId ?? null
  });

  await createMessage({
    threadId: thread.id,
    userId: userId ?? null,
    authorType: "HUMAN",
    content
  });

  revalidatePath(`/issues/${issueNumber}`);
  revalidatePath("/dashboard");
}

export async function enqueueIssueTask(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;

  const agentInput = String(formData.get("agentKey") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!agentInput) throw new Error("Missing agentKey.");
  if (!title) throw new Error("Missing title.");
  const agentKey = await resolveCanonicalRuntimeAgentKey(agentInput);
  if (!agentKey) {
    throw new Error(`Unknown runtime agent key: ${agentInput}`);
  }

  const issue = await getIssueDetails({ issueNumber });
  const promptValidation = validateExecutablePromptPackage(issue.body || "");
  if (!promptValidation.valid) {
    throw new Error(promptPackageMissingSummary(promptValidation));
  }

  const thread = await getOrCreateThread({
    kind: "ISSUE",
    ref: String(issueNumber),
    title: `Issue #${issueNumber}`,
    createdById: userId ?? null
  });

  const { itemId } = await ensureProjectItemForIssue({ issueNumber });
  const boardFields = await getItemSingleSelectValues({ itemId });
  const projectName = String(boardFields["Product"] || "").trim();
  const projectKey = projectName ? projectName.toLowerCase() : null;
  const runtimeConfigResolution = projectName
    ? await resolveRuntimeConfigForTask({
        projectName,
        agentKey
      })
    : null;
  if (projectName) {
    const lease = await getOrchestratorLeaseSnapshot();
    if (lease.health === "STALE" || lease.health === "UNHELD") {
      const decision = getAlphaFailureDecision("LEASE_AUTHORITY_UNAVAILABLE");
      const fallbackReason = `Alpha failure fallback (${decision.failureClass}): ${decision.remediation}`;
      const fallbackTask = await enqueueManualFallbackTask({
        agentKey,
        title,
        issueNumber,
        threadId: thread.id,
        createdById: userId ?? null,
        reason: fallbackReason,
        failureClass: decision.failureClass,
        projectKey,
        projectName,
        metadata: {
          leaseHealth: lease.health,
          leaseOwner: lease.ownerId,
          runtimeConfigDigest: runtimeConfigResolution?.digest ?? null
        }
      });
      await recordAlphaFailureEvent({
        failureClass: decision.failureClass,
        projectKey,
        projectName,
        issueNumber,
        taskId: fallbackTask.id,
        threadId: thread.id,
        leaseHealth: lease.health,
        metadata: {
          leaseOwner: lease.ownerId,
          leaseAgent: lease.ownerAgentKey,
          fallbackTaskId: fallbackTask.id
        }
      });
      await createMessage({
        threadId: thread.id,
        authorType: "SYSTEM",
        content: `Fallback applied: ${fallbackReason}`,
        meta: {
          kind: "alpha_failure_fallback",
          failureClass: decision.failureClass,
          fallbackAction: decision.fallbackAction,
          severity: decision.severity,
          remediation: decision.remediation,
          taskId: fallbackTask.id,
          issueNumber,
          projectName
        }
      });
      revalidatePath(`/issues/${issueNumber}`);
      revalidatePath("/dashboard");
      return;
    }

    const guardrail = await consumeContextBudgetForScopeExpansion({
      projectName,
      actorUserId: userId ?? null,
      sourceAction: "ISSUE_TASK_ENQUEUE",
      incrementPercent: 8,
      metadata: {
        issueNumber,
        agentKey,
        title
      }
    });

    if (!guardrail.allowed) {
      const decision = getAlphaFailureDecision("CONTEXT_GUARDRAIL_BLOCKED");
      const fallbackReason = `Alpha failure fallback (${decision.failureClass}): ${guardrail.reason}`;
      const fallbackTask = await enqueueManualFallbackTask({
        agentKey,
        title,
        issueNumber,
        threadId: thread.id,
        createdById: userId ?? null,
        reason: fallbackReason,
        failureClass: decision.failureClass,
        projectKey,
        projectName,
        metadata: {
          usagePercent: guardrail.usagePercent,
          guardrailStatus: guardrail.status,
          contextWindowId: guardrail.activeWindowId,
          runtimeConfigDigest: runtimeConfigResolution?.digest ?? null
        }
      });
      await recordAlphaFailureEvent({
        failureClass: decision.failureClass,
        projectKey,
        projectName,
        issueNumber,
        taskId: fallbackTask.id,
        threadId: thread.id,
        contextWindowId: guardrail.activeWindowId,
        metadata: {
          usagePercent: guardrail.usagePercent,
          guardrailStatus: guardrail.status
        }
      });
      await createMessage({
        threadId: thread.id,
        authorType: "SYSTEM",
        content: `Fallback applied: ${fallbackReason}`,
        meta: {
          kind: "alpha_failure_fallback",
          failureClass: decision.failureClass,
          fallbackAction: decision.fallbackAction,
          severity: decision.severity,
          issueNumber,
          projectName,
          taskId: fallbackTask.id,
          usagePercent: guardrail.usagePercent,
          status: guardrail.status,
          remediation: decision.remediation,
          reason: fallbackReason
        }
      });
      revalidatePath(`/issues/${issueNumber}`);
      revalidatePath("/dashboard");
      return;
    }

    if (guardrail.status === "WARNING" || guardrail.status === "OVERRIDE_ACTIVE") {
      const warningDecision = getAlphaFailureDecision("CONTEXT_GUARDRAIL_WARNING");
      await recordAlphaFailureEvent({
        failureClass: "CONTEXT_GUARDRAIL_WARNING",
        projectKey,
        projectName,
        issueNumber,
        threadId: thread.id,
        contextWindowId: guardrail.activeWindowId,
        metadata: {
          status: guardrail.status,
          usagePercent: guardrail.usagePercent
        }
      });
      await createMessage({
        threadId: thread.id,
        authorType: "SYSTEM",
        content: `${guardrail.reason} Remediation: ${warningDecision.remediation}`,
        meta: {
          kind: "alpha_context_guardrail_warning",
          issueNumber,
          projectName,
          usagePercent: guardrail.usagePercent,
          status: guardrail.status,
          remediation: warningDecision.remediation
        }
      });
    }
  }

  const task = await enqueueTask({
    agentKey,
    title,
    issueNumber,
    threadId: thread.id,
    createdById: userId ?? null,
    payload: { issueNumber },
    runtimeConfigResolution,
    promptPackageSnapshot: {
      sourceKind: "ISSUE_EXECUTABLE_PROMPT",
      sourceRef: issue.url,
      packageBody: issue.body || null,
      packageSections: promptValidation.sections
    }
  });

  await createMessage({
    threadId: thread.id,
    userId: userId ?? null,
    authorType: "SYSTEM",
    content:
      task.status === "MANUAL_REQUIRED"
        ? `Manual required for @${agentKey}: ${task.error || "Agent is not ready for autonomous execution."}`
        : task.error
        ? `Enqueued task for @${agentKey} (pending): ${task.error}`
        : `Enqueued task for @${agentKey}: ${title}`,
    meta: {
      kind: task.status === "MANUAL_REQUIRED" ? "task_manual_required" : "task_enqueued",
      agentKey,
      title,
      issueNumber,
      taskId: task.id,
      reason: task.error || null
    }
  });

  revalidatePath(`/issues/${issueNumber}`);
}

export async function activateIssueAlphaContextAction(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;
  const projectName = String(formData.get("projectName") || "").trim();
  const ownerAgentKey = String(formData.get("ownerAgentKey") || "").trim();
  const handoverRef = String(formData.get("activationHandoverRef") || "").trim();
  const continuityNote = String(formData.get("continuityNote") || "").trim();
  if (!projectName) throw new Error("Missing project for Alpha context activation.");
  if (!ownerAgentKey) throw new Error("Missing Alpha agent key.");

  const result = await openAndActivateAlphaContextWindow({
    projectName,
    ownerAgentKey,
    actorUserId: userId ?? null,
    activationHandoverRef: handoverRef || null,
    continuityNote: continuityNote || null
  });

  const thread = await getOrCreateThread({
    kind: "ISSUE",
    ref: String(issueNumber),
    title: `Issue #${issueNumber}`,
    createdById: userId ?? null
  });
  await createMessage({
    threadId: thread.id,
    authorType: "SYSTEM",
    content: result.ok
      ? `Alpha context lock activated for ${projectName}: @${ownerAgentKey}.`
      : result.reason,
    meta: {
      kind: result.ok ? "alpha_context_activated" : "alpha_context_activation_denied",
      issueNumber,
      projectName,
      requestedOwnerAgentKey: ownerAgentKey,
      activeWindowId: result.activeWindowId,
      reason: result.reason
    }
  });

  revalidatePath(`/issues/${issueNumber}`);
  revalidatePath("/dashboard");
}

export async function transferIssueAlphaContextAction(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;
  const projectName = String(formData.get("projectName") || "").trim();
  const toAgentKey = String(formData.get("toAgentKey") || "").trim();
  const handoverRef = String(formData.get("handoverRef") || "").trim();
  const continuityNote = String(formData.get("continuityNote") || "").trim();
  if (!projectName) throw new Error("Missing project for Alpha context transfer.");
  if (!toAgentKey) throw new Error("Missing transfer target Alpha agent key.");

  const result = await transferActiveAlphaContextWindow({
    projectName,
    toAgentKey,
    actorUserId: userId ?? null,
    handoverRef,
    continuityNote: continuityNote || null
  });

  const thread = await getOrCreateThread({
    kind: "ISSUE",
    ref: String(issueNumber),
    title: `Issue #${issueNumber}`,
    createdById: userId ?? null
  });
  await createMessage({
    threadId: thread.id,
    authorType: "SYSTEM",
    content: result.ok
      ? `Alpha context lock transferred for ${projectName} to @${toAgentKey}.`
      : result.reason,
    meta: {
      kind: result.ok ? "alpha_context_transferred" : "alpha_context_transfer_denied",
      issueNumber,
      projectName,
      requestedToAgentKey: toAgentKey,
      activeWindowId: result.activeWindowId,
      handoverRef: handoverRef || null,
      reason: result.reason
    }
  });

  revalidatePath(`/issues/${issueNumber}`);
  revalidatePath("/dashboard");
}

export async function closeIssueAlphaContextAction(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;
  const projectName = String(formData.get("projectName") || "").trim();
  const handoverRef = String(formData.get("handoverRef") || "").trim();
  const closeReason = String(formData.get("closeReason") || "").trim();
  if (!projectName) throw new Error("Missing project for Alpha context close.");

  const result = await closeActiveAlphaContextWindow({
    projectName,
    actorUserId: userId ?? null,
    handoverRef,
    closeReason: closeReason || null
  });

  const thread = await getOrCreateThread({
    kind: "ISSUE",
    ref: String(issueNumber),
    title: `Issue #${issueNumber}`,
    createdById: userId ?? null
  });
  await createMessage({
    threadId: thread.id,
    authorType: "SYSTEM",
    content: result.ok
      ? `Alpha context lock closed for ${projectName}.`
      : result.reason,
    meta: {
      kind: result.ok ? "alpha_context_closed" : "alpha_context_close_denied",
      issueNumber,
      projectName,
      activeWindowId: result.activeWindowId,
      handoverRef: handoverRef || null,
      closeReason: closeReason || null,
      reason: result.reason
    }
  });

  revalidatePath(`/issues/${issueNumber}`);
  revalidatePath("/dashboard");
}

export async function recordIssueHandoverPackageAction(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;
  const projectName = String(formData.get("projectName") || "").trim();
  const handoverPackageRef = String(formData.get("handoverPackageRef") || "").trim();
  const continuationPromptRef = String(formData.get("continuationPromptRef") || "").trim();
  const note = String(formData.get("handoverNote") || "").trim();
  if (!projectName) throw new Error("Missing project for handover package update.");

  const result = await recordActiveContextHandoverPackage({
    projectName,
    handoverPackageRef,
    continuationPromptRef,
    note: note || null,
    actorUserId: userId ?? null
  });

  const thread = await getOrCreateThread({
    kind: "ISSUE",
    ref: String(issueNumber),
    title: `Issue #${issueNumber}`,
    createdById: userId ?? null
  });
  await createMessage({
    threadId: thread.id,
    authorType: "SYSTEM",
    content: result.ok
      ? `Handover package recorded for ${projectName}.`
      : result.reason,
    meta: {
      kind: result.ok ? "alpha_context_handover_package" : "alpha_context_handover_package_denied",
      issueNumber,
      projectName,
      activeWindowId: result.activeWindowId,
      handoverPackageRef: handoverPackageRef || null,
      continuationPromptRef: continuationPromptRef || null,
      reason: result.reason
    }
  });

  revalidatePath(`/issues/${issueNumber}`);
  revalidatePath("/dashboard");
}

export async function overrideIssueGuardrailAction(issueNumber: number, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;
  const projectName = String(formData.get("projectName") || "").trim();
  const overrideReason = String(formData.get("overrideReason") || "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") || "30");
  if (!projectName) throw new Error("Missing project for guardrail override.");

  const result = await setContextGuardrailOverride({
    projectName,
    overrideReason,
    durationMinutes,
    actorUserId: userId ?? null
  });

  const thread = await getOrCreateThread({
    kind: "ISSUE",
    ref: String(issueNumber),
    title: `Issue #${issueNumber}`,
    createdById: userId ?? null
  });
  await createMessage({
    threadId: thread.id,
    authorType: "SYSTEM",
    content: result.ok
      ? `Guardrail override set for ${projectName}.`
      : result.reason,
    meta: {
      kind: result.ok ? "alpha_context_guardrail_override" : "alpha_context_guardrail_override_denied",
      issueNumber,
      projectName,
      activeWindowId: result.activeWindowId,
      durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 30,
      reason: result.reason
    }
  });

  revalidatePath(`/issues/${issueNumber}`);
  revalidatePath("/dashboard");
}
