//> String literal line.
"use server";

/**
 * Server actions for chat: post global message, parse `@agent` / tool-call / approval commands, enqueue tasks.
 *
 * Revalidates `/chat` after mutations. Tool protocol validation and approval token creation live here.
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
import { parseAgentMention } from "@/lib/mentions";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { enqueueTask } from "@/lib/tasks";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  parseToolCallApprovalRequestCommand,
  //> Source statement or expression.
  parseToolCallCommand,
  //> Source statement or expression.
  summarizeToolCallProtocolEnvelope,
  //> Source statement or expression.
  validateToolCallProtocolEnvelope
//> Source statement or expression.
} from "@/lib/tool-call-protocol";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  buildToolCallActionFingerprint,
  //> Source statement or expression.
  createToolCallApprovalToken
//> Source statement or expression.
} from "@/lib/tool-call-approval";

//> Export declaration.
export async function sendGlobalMessage(formData: FormData) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userEmail = ((session.user as any).email as string | undefined) ?? null;
  //> Variable declaration.
  const content = String(formData.get("content") || "").trim();
  //> Conditional branch.
  if (!content) return;

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "GLOBAL",
    //> Source statement or expression.
    ref: "main",
    //> Source statement or expression.
    title: "Global",
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

  //> Variable declaration.
  const mention = parseAgentMention(content);
  //> Conditional branch.
  if (mention.kind === "invalid") {
    //> Await async value.
    await createMessage({
      //> Source statement or expression.
      threadId: thread.id,
      //> Source statement or expression.
      authorType: "SYSTEM",
      //> Source statement or expression.
      content: `Mention not queued: ${mention.reason}`,
      //> Source statement or expression.
      meta: {
        //> Source statement or expression.
        kind: "mention_invalid",
        //> Source statement or expression.
        reason: mention.reason,
        //> Source statement or expression.
        raw: mention.raw
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
  //> Source statement or expression.
  } else if (mention.kind === "agent") {
    //> Variable declaration.
    const knownAgent = await prisma.agent.findFirst({
      //> Source statement or expression.
      where: {
        //> Source statement or expression.
        key: { equals: mention.agentKey, mode: "insensitive" }
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      select: { key: true }
    //> Brace or statement terminator.
    });

    //> Conditional branch.
    if (!knownAgent) {
      //> Await async value.
      await createMessage({
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        authorType: "SYSTEM",
        //> Source statement or expression.
        content: `Mention not queued: @${mention.agentKey} is not a registered DB agent key.`,
        //> Source statement or expression.
        meta: {
          //> Source statement or expression.
          kind: "mention_unmapped",
          //> Source statement or expression.
          requestedAgent: mention.agentKey
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
    //> Source statement or expression.
    } else {
      //> Variable declaration.
      const approvalCommand = parseToolCallApprovalRequestCommand(mention.command);
      //> Conditional branch.
      if (approvalCommand.kind === "invalid") {
        //> Await async value.
        await createMessage({
          //> Source statement or expression.
          threadId: thread.id,
          //> Source statement or expression.
          authorType: "SYSTEM",
          //> Source statement or expression.
          content: `Approval token not issued: ${approvalCommand.reason}`,
          //> Source statement or expression.
          meta: {
            //> Source statement or expression.
            kind: "tool_call_approval_invalid",
            //> Source statement or expression.
            reason: approvalCommand.reason
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        revalidatePath("/chat");
        //> Return to caller.
        return;
      //> Brace or statement terminator.
      }
      //> Conditional branch.
      if (approvalCommand.kind === "approve_tool_call") {
        //> Conditional branch.
        if (!userId) {
          //> Await async value.
          await createMessage({
            //> Source statement or expression.
            threadId: thread.id,
            //> Source statement or expression.
            authorType: "SYSTEM",
            //> Source statement or expression.
            content: "Approval token not issued: approver identity is missing from session.",
            //> Source statement or expression.
            meta: {
              //> Source statement or expression.
              kind: "tool_call_approval_denied",
              //> Source statement or expression.
              reason: "Approver identity is missing from session."
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          });
          //> Source statement or expression.
          revalidatePath("/chat");
          //> Return to caller.
          return;
        //> Brace or statement terminator.
        }
        //> Variable declaration.
        const validation = validateToolCallProtocolEnvelope(approvalCommand.envelopeInput);
        //> Conditional branch.
        if (!validation.present || !validation.ok) {
          //> Await async value.
          await createMessage({
            //> Source statement or expression.
            threadId: thread.id,
            //> Source statement or expression.
            authorType: "SYSTEM",
            //> Source statement or expression.
            content: `Approval token not issued: ${validation.ok ? "tool-call payload is missing." : validation.reason}`,
            //> Source statement or expression.
            meta: {
              //> Source statement or expression.
              kind: "tool_call_approval_denied",
              //> Source statement or expression.
              reason: validation.ok ? "tool-call payload is missing." : validation.reason
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          });
          //> Source statement or expression.
          revalidatePath("/chat");
          //> Return to caller.
          return;
        //> Brace or statement terminator.
        }
        //> Variable declaration.
        const actionFingerprint = buildToolCallActionFingerprint(validation.envelope);
        //> Variable declaration.
        const tokenResult = createToolCallApprovalToken({
          //> Source statement or expression.
          approverUserId: userId,
          //> Source statement or expression.
          approverEmail: userEmail,
          //> Source statement or expression.
          actionFingerprint,
          //> Source statement or expression.
          ttlSeconds: approvalCommand.ttlSeconds ?? undefined
        //> Brace or statement terminator.
        });
        //> Await async value.
        await createMessage({
          //> Source statement or expression.
          threadId: thread.id,
          //> Source statement or expression.
          authorType: "SYSTEM",
          //> Source statement or expression.
          content:
            //> String literal line.
            `Approval token issued for @${knownAgent.key}. ` +
            //> String literal line.
            `Expires: ${tokenResult.expiresAt}. ` +
            //> String literal line.
            `Use with tool-call wrapper field \"approvalToken\".\n` +
            //> String literal line.
            `Token: ${tokenResult.token}`,
          //> Source statement or expression.
          meta: {
            //> Source statement or expression.
            kind: "tool_call_approval_issued",
            //> Source statement or expression.
            agentKey: knownAgent.key,
            //> Source statement or expression.
            approverUserId: userId,
            //> Source statement or expression.
            approverEmail: userEmail,
            //> Source statement or expression.
            tokenId: tokenResult.tokenId,
            //> Source statement or expression.
            expiresAt: tokenResult.expiresAt,
            //> Source statement or expression.
            actionFingerprint,
            //> Source statement or expression.
            ...summarizeToolCallProtocolEnvelope(validation.envelope)
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        revalidatePath("/chat");
        //> Return to caller.
        return;
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const toolCallCommand = parseToolCallCommand(mention.command);
      //> Conditional branch.
      if (toolCallCommand.kind === "invalid") {
        //> Await async value.
        await createMessage({
          //> Source statement or expression.
          threadId: thread.id,
          //> Source statement or expression.
          authorType: "SYSTEM",
          //> Source statement or expression.
          content: `Mention not queued: ${toolCallCommand.reason}`,
          //> Source statement or expression.
          meta: {
            //> Source statement or expression.
            kind: "tool_call_invalid",
            //> Source statement or expression.
            reason: toolCallCommand.reason
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Source statement or expression.
        revalidatePath("/chat");
        //> Return to caller.
        return;
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const isToolCall = toolCallCommand.kind === "tool_call";
      //> Variable declaration.
      const taskTitle = isToolCall ? toolCallCommand.title : mention.command;
      //> Variable declaration.
      const payload: Record<string, unknown> = {
        //> Source statement or expression.
        kind: isToolCall ? "chat_mention_tool_call" : "chat_mention",
        //> Source statement or expression.
        command: mention.command
      //> Brace or statement terminator.
      };
      //> Conditional branch.
      if (isToolCall) {
        //> Source statement or expression.
        payload.toolCallProtocol = toolCallCommand.envelopeInput;
        //> Conditional branch.
        if (toolCallCommand.approvalToken) {
          //> Source statement or expression.
          payload.toolCallApprovalToken = toolCallCommand.approvalToken;
        //> Brace or statement terminator.
        }
        //> Source statement or expression.
        payload.toolCallPolicy = {
          //> Source statement or expression.
          dryRun: toolCallCommand.dryRun
        //> Brace or statement terminator.
        };
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const task = await enqueueTask({
        //> Source statement or expression.
        agentKey: knownAgent.key,
        //> Source statement or expression.
        title: taskTitle,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        createdById: userId ?? null,
        //> Source statement or expression.
        payload
      //> Brace or statement terminator.
      });

      //> Await async value.
      await createMessage({
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        authorType: "SYSTEM",
        //> Source statement or expression.
        content:
          //> Source statement or expression.
          task.status === "MANUAL_REQUIRED"
            //> Source statement or expression.
            ? `Manual required for @${knownAgent.key}: ${task.error || "Agent is not ready for autonomous execution."}`
            //> Source statement or expression.
            : task.error
            //> Source statement or expression.
            ? `Queued for @${knownAgent.key} (pending): ${task.error}`
            //> Source statement or expression.
            : isToolCall
            //> Source statement or expression.
            ? `Queued structured tool-call payload for @${knownAgent.key}.`
            //> Source statement or expression.
            : `Queued for @${knownAgent.key}: ${mention.command}`,
        //> Source statement or expression.
        meta: {
          //> Source statement or expression.
          kind: task.status === "MANUAL_REQUIRED" ? "task_manual_required" : "task_enqueued",
          //> Source statement or expression.
          agentKey: knownAgent.key,
          //> Source statement or expression.
          taskId: task.id,
          //> Source statement or expression.
          reason: task.error || null,
          //> Source statement or expression.
          structuredToolCall: isToolCall
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Source statement or expression.
  revalidatePath("/chat");
//> Brace or statement terminator.
}
