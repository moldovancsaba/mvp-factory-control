/**
 * Chat persistence: threads keyed by `(kind, ref)` and ordered messages with optional user relation.
 * Used by `src/app/chat/*` and mention-driven task creation. `authorType` distinguishes human, agent, system.
 */
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";

//> Export declaration.
export async function getOrCreateThread(params: {
  //> Source statement or expression.
  kind: "GLOBAL" | "ISSUE" | "PRODUCT";
  //> Source statement or expression.
  ref: string;
  //> Source statement or expression.
  title?: string;
  //> Source statement or expression.
  createdById?: string | null;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const existing = await prisma.chatThread.findUnique({
    //> Source statement or expression.
    where: { kind_ref: { kind: params.kind, ref: params.ref } }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (existing) return existing;

  //> Return a value.
  return prisma.chatThread.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      kind: params.kind,
      //> Source statement or expression.
      ref: params.ref,
      //> Source statement or expression.
      title: params.title,
      //> Source statement or expression.
      createdById: params.createdById ?? null
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function listMessages(threadId: string, limit = 200) {
  //> Return a value.
  return prisma.chatMessage.findMany({
    //> Source statement or expression.
    where: { threadId },
    //> Source statement or expression.
    orderBy: { createdAt: "asc" },
    //> Source statement or expression.
    take: limit,
    //> Source statement or expression.
    include: { user: true }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function createMessage(params: {
  //> Source statement or expression.
  threadId: string;
  //> Source statement or expression.
  userId?: string | null;
  //> Source statement or expression.
  authorType: "HUMAN" | "AGENT" | "SYSTEM";
  //> Source statement or expression.
  authorKey?: string | null;
  //> Source statement or expression.
  content: string;
  //> Source statement or expression.
  meta?: unknown;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const content = params.content.trim();
  //> Conditional branch.
  if (!content) throw new Error("Empty message.");
  //> Conditional branch.
  if (content.length > 12000) throw new Error("Message too large.");

  //> Return a value.
  return prisma.chatMessage.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      threadId: params.threadId,
      //> Source statement or expression.
      userId: params.userId ?? null,
      //> Source statement or expression.
      authorType: params.authorType,
      //> Source statement or expression.
      authorKey: params.authorKey ?? null,
      //> Source statement or expression.
      content,
      //> Source statement or expression.
      meta: params.meta as never
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

