"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMessage, getOrCreateThread } from "@/lib/chat";
import { parseAgentMention } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";
import { enqueueTask } from "@/lib/tasks";
import {
  parseToolCallApprovalRequestCommand,
  parseToolCallCommand,
  summarizeToolCallProtocolEnvelope,
  validateToolCallProtocolEnvelope
} from "@/lib/tool-call-protocol";
import {
  buildToolCallActionFingerprint,
  createToolCallApprovalToken
} from "@/lib/tool-call-approval";

export async function sendGlobalMessage(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userEmail = ((session.user as any).email as string | undefined) ?? null;
  const content = String(formData.get("content") || "").trim();
  if (!content) return;

  const thread = await getOrCreateThread({
    kind: "GLOBAL",
    ref: "main",
    title: "Global",
    createdById: userId ?? null
  });

  await createMessage({
    threadId: thread.id,
    userId: userId ?? null,
    authorType: "HUMAN",
    content
  });

  const mention = parseAgentMention(content);
  if (mention.kind === "invalid") {
    await createMessage({
      threadId: thread.id,
      authorType: "SYSTEM",
      content: `Mention not queued: ${mention.reason}`,
      meta: {
        kind: "mention_invalid",
        reason: mention.reason,
        raw: mention.raw
      }
    });
  } else if (mention.kind === "agent") {
    const knownAgent = await prisma.agent.findFirst({
      where: {
        key: { equals: mention.agentKey, mode: "insensitive" }
      },
      select: { key: true }
    });

    if (!knownAgent) {
      await createMessage({
        threadId: thread.id,
        authorType: "SYSTEM",
        content: `Mention not queued: @${mention.agentKey} is not a registered DB agent key.`,
        meta: {
          kind: "mention_unmapped",
          requestedAgent: mention.agentKey
        }
      });
    } else {
      const approvalCommand = parseToolCallApprovalRequestCommand(mention.command);
      if (approvalCommand.kind === "invalid") {
        await createMessage({
          threadId: thread.id,
          authorType: "SYSTEM",
          content: `Approval token not issued: ${approvalCommand.reason}`,
          meta: {
            kind: "tool_call_approval_invalid",
            reason: approvalCommand.reason
          }
        });
        revalidatePath("/chat");
        return;
      }
      if (approvalCommand.kind === "approve_tool_call") {
        if (!userId) {
          await createMessage({
            threadId: thread.id,
            authorType: "SYSTEM",
            content: "Approval token not issued: approver identity is missing from session.",
            meta: {
              kind: "tool_call_approval_denied",
              reason: "Approver identity is missing from session."
            }
          });
          revalidatePath("/chat");
          return;
        }
        const validation = validateToolCallProtocolEnvelope(approvalCommand.envelopeInput);
        if (!validation.present || !validation.ok) {
          await createMessage({
            threadId: thread.id,
            authorType: "SYSTEM",
            content: `Approval token not issued: ${validation.ok ? "tool-call payload is missing." : validation.reason}`,
            meta: {
              kind: "tool_call_approval_denied",
              reason: validation.ok ? "tool-call payload is missing." : validation.reason
            }
          });
          revalidatePath("/chat");
          return;
        }
        const actionFingerprint = buildToolCallActionFingerprint(validation.envelope);
        const tokenResult = createToolCallApprovalToken({
          approverUserId: userId,
          approverEmail: userEmail,
          actionFingerprint,
          ttlSeconds: approvalCommand.ttlSeconds ?? undefined
        });
        await createMessage({
          threadId: thread.id,
          authorType: "SYSTEM",
          content:
            `Approval token issued for @${knownAgent.key}. ` +
            `Expires: ${tokenResult.expiresAt}. ` +
            `Use with tool-call wrapper field \"approvalToken\".\n` +
            `Token: ${tokenResult.token}`,
          meta: {
            kind: "tool_call_approval_issued",
            agentKey: knownAgent.key,
            approverUserId: userId,
            approverEmail: userEmail,
            tokenId: tokenResult.tokenId,
            expiresAt: tokenResult.expiresAt,
            actionFingerprint,
            ...summarizeToolCallProtocolEnvelope(validation.envelope)
          }
        });
        revalidatePath("/chat");
        return;
      }

      const toolCallCommand = parseToolCallCommand(mention.command);
      if (toolCallCommand.kind === "invalid") {
        await createMessage({
          threadId: thread.id,
          authorType: "SYSTEM",
          content: `Mention not queued: ${toolCallCommand.reason}`,
          meta: {
            kind: "tool_call_invalid",
            reason: toolCallCommand.reason
          }
        });
        revalidatePath("/chat");
        return;
      }

      const isToolCall = toolCallCommand.kind === "tool_call";
      const taskTitle = isToolCall ? toolCallCommand.title : mention.command;
      const payload: Record<string, unknown> = {
        kind: isToolCall ? "chat_mention_tool_call" : "chat_mention",
        command: mention.command
      };
      if (isToolCall) {
        payload.toolCallProtocol = toolCallCommand.envelopeInput;
        if (toolCallCommand.approvalToken) {
          payload.toolCallApprovalToken = toolCallCommand.approvalToken;
        }
        payload.toolCallPolicy = {
          dryRun: toolCallCommand.dryRun
        };
      }

      const task = await enqueueTask({
        agentKey: knownAgent.key,
        title: taskTitle,
        threadId: thread.id,
        createdById: userId ?? null,
        payload
      });

      await createMessage({
        threadId: thread.id,
        authorType: "SYSTEM",
        content:
          task.status === "MANUAL_REQUIRED"
            ? `Manual required for @${knownAgent.key}: ${task.error || "Agent is not ready for autonomous execution."}`
            : task.error
            ? `Queued for @${knownAgent.key} (pending): ${task.error}`
            : isToolCall
            ? `Queued structured tool-call payload for @${knownAgent.key}.`
            : `Queued for @${knownAgent.key}: ${mention.command}`,
        meta: {
          kind: task.status === "MANUAL_REQUIRED" ? "task_manual_required" : "task_enqueued",
          agentKey: knownAgent.key,
          taskId: task.id,
          reason: task.error || null,
          structuredToolCall: isToolCall
        }
      });
    }
  }

  revalidatePath("/chat");
}
