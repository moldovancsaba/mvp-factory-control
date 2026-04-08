/**
 * Inbound **email** pipeline: validates sender, parses `@Agent` mentions, enqueues tasks, records chat.
 *
 * Invoked from `src/app/api/ingress/email/route.ts`. Defines payload shape, allowlists, retry/dead-letter
 * behavior, and audit metadata for abuse and delivery diagnostics.
 */
//> Import bindings from a module.
import { createMessage, getOrCreateThread } from "@/lib/chat";
//> Import bindings from a module.
import { parseAgentMention } from "@/lib/mentions";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { enqueueTask } from "@/lib/tasks";

//> Type or interface definition.
type IngressStatus =
  //> Source statement or expression.
  | "RECEIVED"
  //> Source statement or expression.
  | "BLOCKED"
  //> Source statement or expression.
  | "ENQUEUED"
  //> Source statement or expression.
  | "RETRY_SCHEDULED"
  //> Source statement or expression.
  | "DEAD_LETTER";

//> Type or interface definition.
type SenderAuthResult = {
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  reason: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type InboundEmailPayload = {
  //> Source statement or expression.
  channel?: string;
  //> Source statement or expression.
  messageId?: string | null;
  //> Source statement or expression.
  from?: {
    //> Source statement or expression.
    email?: string | null;
    //> Source statement or expression.
    name?: string | null;
  //> Source statement or expression.
  } | null;
  //> Source statement or expression.
  subject?: string | null;
  //> Source statement or expression.
  text?: string | null;
  //> Source statement or expression.
  issueNumber?: number | null;
  //> Source statement or expression.
  agentKey?: string | null;
  //> Source statement or expression.
  command?: string | null;
  //> Source statement or expression.
  metadata?: unknown;
//> Brace or statement terminator.
};

//> Source statement or expression.
class IngressError extends Error {
  //> Source statement or expression.
  code: string;
  //> Source statement or expression.
  retryable: boolean;

  //> Source statement or expression.
  constructor(code: string, message: string, retryable: boolean) {
    //> Source statement or expression.
    super(message);
    //> Source statement or expression.
    this.code = code;
    //> Source statement or expression.
    this.retryable = retryable;
    //> Source statement or expression.
    this.name = "IngressError";
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeEmail(input: string) {
  //> Return a value.
  return String(input || "").trim().toLowerCase();
//> Brace or statement terminator.
}

//> Function declaration.
function parseAddressList(raw: string | undefined) {
  //> Conditional branch.
  if (!raw) return new Set<string>();
  //> Return a value.
  return new Set(
    //> Source statement or expression.
    raw
      //> Source statement or expression.
      .split(",")
      //> Source statement or expression.
      .map((value) => normalizeEmail(value))
      //> Source statement or expression.
      .filter(Boolean)
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Function declaration.
function isTruthy(value: string | undefined, fallback = false) {
  //> Conditional branch.
  if (value === undefined) return fallback;
  //> Variable declaration.
  const normalized = String(value).trim().toLowerCase();
  //> Return a value.
  return normalized === "1" || normalized === "true" || normalized === "yes";
//> Brace or statement terminator.
}

//> Function declaration.
function resolveSenderAuth(senderEmail: string): SenderAuthResult {
  //> Variable declaration.
  const blocked = parseAddressList(process.env.MVP_FACTORY_CONTROL_EMAIL_BLOCKED_SENDERS);
  //> Variable declaration.
  const trusted = parseAddressList(process.env.MVP_FACTORY_CONTROL_EMAIL_TRUSTED_SENDERS);
  //> Variable declaration.
  const requireTrusted = isTruthy(process.env.MVP_FACTORY_CONTROL_EMAIL_REQUIRE_TRUSTED, true);
  //> Variable declaration.
  const email = normalizeEmail(senderEmail);

  //> Conditional branch.
  if (!email) {
    //> Return a value.
    return { allowed: false, reason: "Sender email is missing." };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (blocked.has(email)) {
    //> Return a value.
    return { allowed: false, reason: "Sender is blocked by MVP_FACTORY_CONTROL_EMAIL_BLOCKED_SENDERS." };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (requireTrusted && !trusted.has(email)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason: "Sender is not in MVP_FACTORY_CONTROL_EMAIL_TRUSTED_SENDERS."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return { allowed: true, reason: "Sender is authorized for email ingress." };
//> Brace or statement terminator.
}

//> Function declaration.
function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  //> Variable declaration.
  const parsed = Number(value ?? "");
  //> Conditional branch.
  if (!Number.isFinite(parsed)) return fallback;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(parsed), min), max);
//> Brace or statement terminator.
}

//> Function declaration.
function computeRetryDelayMs(attempt: number) {
  //> Variable declaration.
  const base = clampInt(process.env.MVP_FACTORY_CONTROL_EMAIL_RETRY_BASE_MS, 1_000, 100, 60_000);
  //> Variable declaration.
  const max = clampInt(process.env.MVP_FACTORY_CONTROL_EMAIL_RETRY_MAX_MS, 15_000, base, 300_000);
  //> Return a value.
  return Math.min(base * 2 ** Math.max(attempt - 1, 0), max);
//> Brace or statement terminator.
}

//> Function declaration.
function sleep(ms: number) {
  //> Return a value.
  return new Promise((resolve) => setTimeout(resolve, ms));
//> Brace or statement terminator.
}

//> Function declaration.
function firstMentionCandidate(subject: string, bodyText: string) {
  //> Variable declaration.
  const subjectLine = String(subject || "").trim();
  //> Conditional branch.
  if (subjectLine.startsWith("@")) return subjectLine;
  //> For-loop header.
  for (const line of String(bodyText || "").split(/\r?\n/)) {
    //> Variable declaration.
    const trimmed = line.trim();
    //> Conditional branch.
    if (!trimmed) continue;
    //> Conditional branch.
    if (trimmed.startsWith("@")) return trimmed;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return "";
//> Brace or statement terminator.
}

//> Async function declaration.
async function ensureEmailIntakeAgentKey() {
  //> Variable declaration.
  const preferred = "EmailIntake";
  //> Variable declaration.
  const existing = await prisma.agent.findFirst({
    //> Source statement or expression.
    where: { key: { equals: preferred, mode: "insensitive" } },
    //> Source statement or expression.
    select: { key: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (existing?.key) return existing.key;
  //> Variable declaration.
  const created = await prisma.agent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      key: preferred,
      //> Source statement or expression.
      displayName: "Email Intake",
      //> Source statement or expression.
      runtime: "MANUAL",
      //> Source statement or expression.
      readiness: "NOT_READY",
      //> Source statement or expression.
      enabled: true
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    select: { key: true }
  //> Brace or statement terminator.
  });
  //> Return a value.
  return created.key;
//> Brace or statement terminator.
}

//> Function declaration.
function normalizePayload(input: InboundEmailPayload) {
  //> Variable declaration.
  const channel = String(input.channel || "email").trim().toLowerCase();
  //> Conditional branch.
  if (channel !== "email") {
    //> Throw error.
    throw new IngressError(
      //> String literal line.
      "INVALID_CHANNEL",
      //> String literal line.
      `Unsupported external ingress channel "${channel}". Only "email" is allowed in MVP.`,
      //> Source statement or expression.
      false
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const senderEmail = normalizeEmail(input.from?.email || "");
  //> Variable declaration.
  const senderName = String(input.from?.name || "").trim() || null;
  //> Variable declaration.
  const subject = String(input.subject || "").trim();
  //> Variable declaration.
  const bodyText = String(input.text || "").trim();
  //> Conditional branch.
  if (!senderEmail) {
    //> Throw error.
    throw new IngressError("INVALID_PAYLOAD", "Missing sender email.", false);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!subject && !bodyText) {
    //> Throw error.
    throw new IngressError("INVALID_PAYLOAD", "Email payload has no subject/body.", false);
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    channel,
    //> Source statement or expression.
    externalMessageId: String(input.messageId || "").trim() || null,
    //> Source statement or expression.
    senderEmail,
    //> Source statement or expression.
    senderName,
    //> Source statement or expression.
    subject: subject || "(no subject)",
    //> Source statement or expression.
    bodyText: bodyText || "(empty body)",
    //> Source statement or expression.
    issueNumber:
      //> Source statement or expression.
      typeof input.issueNumber === "number" && Number.isFinite(input.issueNumber)
        //> Source statement or expression.
        ? Math.trunc(input.issueNumber)
        //> Source statement or expression.
        : null,
    //> Source statement or expression.
    explicitAgentKey: String(input.agentKey || "").trim() || null,
    //> Source statement or expression.
    explicitCommand: String(input.command || "").trim() || null,
    //> Source statement or expression.
    metadata: input.metadata ?? null
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveTargetTask(normalized: ReturnType<typeof normalizePayload>) {
  //> Conditional branch.
  if (normalized.explicitAgentKey && normalized.explicitCommand) {
    //> Return a value.
    return {
      //> Source statement or expression.
      requestedAgentKey: normalized.explicitAgentKey,
      //> Source statement or expression.
      title: normalized.explicitCommand
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const mentionCandidate = firstMentionCandidate(normalized.subject, normalized.bodyText);
  //> Conditional branch.
  if (mentionCandidate) {
    //> Variable declaration.
    const parsed = parseAgentMention(mentionCandidate);
    //> Conditional branch.
    if (parsed.kind === "agent") {
      //> Return a value.
      return {
        //> Source statement or expression.
        requestedAgentKey: parsed.agentKey,
        //> Source statement or expression.
        title: parsed.command
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    requestedAgentKey: await ensureEmailIntakeAgentKey(),
    //> Source statement or expression.
    title: `Email triage: ${normalized.subject}`
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function classifyIngressFailure(error: unknown) {
  //> Conditional branch.
  if (error instanceof IngressError) {
    //> Return a value.
    return {
      //> Source statement or expression.
      code: error.code,
      //> Source statement or expression.
      retryable: error.retryable,
      //> Source statement or expression.
      message: error.message
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const message = error instanceof Error ? error.message : String(error);
  //> Conditional branch.
  if (/timeout|timed out|econnrefused|network|fetch/i.test(message)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      code: "PIPELINE_TRANSIENT",
      //> Source statement or expression.
      retryable: true,
      //> Source statement or expression.
      message
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    code: "PIPELINE_FAILURE",
    //> Source statement or expression.
    retryable: false,
    //> Source statement or expression.
    message
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export async function handleInboundEmail(payload: InboundEmailPayload) {
  //> Variable declaration.
  const normalized = normalizePayload(payload);
  //> Variable declaration.
  const senderAuth = resolveSenderAuth(normalized.senderEmail);
  //> Variable declaration.
  const maxAttempts = clampInt(process.env.MVP_FACTORY_CONTROL_EMAIL_RETRY_MAX_ATTEMPTS, 3, 1, 10);

  //> Variable declaration.
  const existing = normalized.externalMessageId
    //> Source statement or expression.
    ? await prisma.inboundEmailEvent.findUnique({
        //> Source statement or expression.
        where: { externalMessageId: normalized.externalMessageId }
      //> Delimiter or separator.
      })
    //> Source statement or expression.
    : null;
  //> Conditional branch.
  if (existing?.status === "ENQUEUED") {
    //> Return a value.
    return {
      //> Source statement or expression.
      accepted: true,
      //> Source statement or expression.
      status: "ENQUEUED" as const,
      //> Source statement or expression.
      eventId: existing.id,
      //> Source statement or expression.
      reason: "Duplicate message id already processed."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const event = existing
    //> Source statement or expression.
    ? await prisma.inboundEmailEvent.update({
        //> Source statement or expression.
        where: { id: existing.id },
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          senderEmail: normalized.senderEmail,
          //> Source statement or expression.
          senderName: normalized.senderName,
          //> Source statement or expression.
          subject: normalized.subject,
          //> Source statement or expression.
          bodyText: normalized.bodyText,
          //> Source statement or expression.
          authorized: senderAuth.allowed,
          //> Source statement or expression.
          authorizationReason: senderAuth.reason,
          //> Source statement or expression.
          status: "RECEIVED",
          //> Source statement or expression.
          maxAttempts,
          //> Source statement or expression.
          lastFailureCode: null,
          //> Source statement or expression.
          lastFailureMessage: null,
          //> Source statement or expression.
          nextAttemptAt: null,
          //> Source statement or expression.
          meta: {
            //> Source statement or expression.
            issueNumber: normalized.issueNumber,
            //> Source statement or expression.
            metadata: normalized.metadata
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Delimiter or separator.
      })
    //> Source statement or expression.
    : await prisma.inboundEmailEvent.create({
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          externalMessageId: normalized.externalMessageId,
          //> Source statement or expression.
          channel: "email",
          //> Source statement or expression.
          senderEmail: normalized.senderEmail,
          //> Source statement or expression.
          senderName: normalized.senderName,
          //> Source statement or expression.
          subject: normalized.subject,
          //> Source statement or expression.
          bodyText: normalized.bodyText,
          //> Source statement or expression.
          authorized: senderAuth.allowed,
          //> Source statement or expression.
          authorizationReason: senderAuth.reason,
          //> Source statement or expression.
          status: "RECEIVED",
          //> Source statement or expression.
          maxAttempts,
          //> Source statement or expression.
          meta: {
            //> Source statement or expression.
            issueNumber: normalized.issueNumber,
            //> Source statement or expression.
            metadata: normalized.metadata
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });

  //> Conditional branch.
  if (!senderAuth.allowed) {
    //> Await async value.
    await prisma.inboundEmailEvent.update({
      //> Source statement or expression.
      where: { id: event.id },
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        status: "BLOCKED",
        //> Source statement or expression.
        lastFailureCode: "SENDER_NOT_AUTHORIZED",
        //> Source statement or expression.
        lastFailureMessage: senderAuth.reason
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
    //> Return a value.
    return {
      //> Source statement or expression.
      accepted: false,
      //> Source statement or expression.
      status: "BLOCKED" as const,
      //> Source statement or expression.
      eventId: event.id,
      //> Source statement or expression.
      reason: senderAuth.reason
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> For-loop header.
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    //> Try block start.
    try {
      //> Variable declaration.
      const thread = await getOrCreateThread({
        //> Source statement or expression.
        kind: "GLOBAL",
        //> Source statement or expression.
        ref: "email-inbox",
        //> Source statement or expression.
        title: "Email Ingress Inbox",
        //> Source statement or expression.
        createdById: null
      //> Brace or statement terminator.
      });

      //> Await async value.
      await createMessage({
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        authorType: "HUMAN",
        //> Source statement or expression.
        content: `Email from ${normalized.senderEmail}\nSubject: ${normalized.subject}\n\n${normalized.bodyText}`,
        //> Source statement or expression.
        meta: {
          //> Source statement or expression.
          kind: "email_ingress_message",
          //> Source statement or expression.
          inboundEventId: event.id,
          //> Source statement or expression.
          senderEmail: normalized.senderEmail,
          //> Source statement or expression.
          senderName: normalized.senderName,
          //> Source statement or expression.
          issueNumber: normalized.issueNumber
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });

      //> Variable declaration.
      const targetTask = await resolveTargetTask(normalized);
      //> Variable declaration.
      const knownAgent = await prisma.agent.findFirst({
        //> Source statement or expression.
        where: { key: { equals: targetTask.requestedAgentKey, mode: "insensitive" } },
        //> Source statement or expression.
        select: { key: true }
      //> Brace or statement terminator.
      });
      //> Variable declaration.
      const resolvedAgentKey = knownAgent?.key || (await ensureEmailIntakeAgentKey());
      //> Variable declaration.
      const task = await enqueueTask({
        //> Source statement or expression.
        agentKey: resolvedAgentKey,
        //> Source statement or expression.
        title: targetTask.title,
        //> Source statement or expression.
        issueNumber: normalized.issueNumber ?? undefined,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        payload: {
          //> Source statement or expression.
          kind: "email_ingress_task",
          //> Source statement or expression.
          inboundEventId: event.id,
          //> Source statement or expression.
          senderEmail: normalized.senderEmail,
          //> Source statement or expression.
          senderName: normalized.senderName,
          //> Source statement or expression.
          subject: normalized.subject,
          //> Source statement or expression.
          requestedAgentKey: targetTask.requestedAgentKey
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });

      //> Await async value.
      await prisma.inboundEmailEvent.update({
        //> Source statement or expression.
        where: { id: event.id },
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          status: "ENQUEUED",
          //> Source statement or expression.
          attemptCount: attempt,
          //> Source statement or expression.
          threadId: thread.id,
          //> Source statement or expression.
          taskId: task.id,
          //> Source statement or expression.
          nextAttemptAt: null,
          //> Source statement or expression.
          lastFailureCode: null,
          //> Source statement or expression.
          lastFailureMessage: null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });

      //> Return a value.
      return {
        //> Source statement or expression.
        accepted: true,
        //> Source statement or expression.
        status: "ENQUEUED" as const,
        //> Source statement or expression.
        eventId: event.id,
        //> Source statement or expression.
        threadId: thread.id,
        //> Source statement or expression.
        taskId: task.id,
        //> Source statement or expression.
        reason: "Email ingress normalized and task recorded."
      //> Brace or statement terminator.
      };
    //> Source statement or expression.
    } catch (error) {
      //> Variable declaration.
      const failure = classifyIngressFailure(error);
      //> Variable declaration.
      const willRetry = failure.retryable && attempt < maxAttempts;
      //> Conditional branch.
      if (willRetry) {
        //> Variable declaration.
        const delayMs = computeRetryDelayMs(attempt);
        //> Variable declaration.
        const nextAttemptAt = new Date(Date.now() + delayMs);
        //> Await async value.
        await prisma.inboundEmailEvent.update({
          //> Source statement or expression.
          where: { id: event.id },
          //> Source statement or expression.
          data: {
            //> Source statement or expression.
            status: "RETRY_SCHEDULED",
            //> Source statement or expression.
            attemptCount: attempt,
            //> Source statement or expression.
            nextAttemptAt,
            //> Source statement or expression.
            lastFailureCode: failure.code,
            //> Source statement or expression.
            lastFailureMessage: failure.message
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        });
        //> Await async value.
        await sleep(delayMs);
        //> Source statement or expression.
        continue;
      //> Brace or statement terminator.
      }

      //> Await async value.
      await prisma.inboundEmailEvent.update({
        //> Source statement or expression.
        where: { id: event.id },
        //> Source statement or expression.
        data: {
          //> Source statement or expression.
          status: "DEAD_LETTER",
          //> Source statement or expression.
          attemptCount: attempt,
          //> Source statement or expression.
          nextAttemptAt: null,
          //> Source statement or expression.
          lastFailureCode: failure.code,
          //> Source statement or expression.
          lastFailureMessage: failure.message
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });
      //> Return a value.
      return {
        //> Source statement or expression.
        accepted: false,
        //> Source statement or expression.
        status: "DEAD_LETTER" as const,
        //> Source statement or expression.
        eventId: event.id,
        //> Source statement or expression.
        reason: `[${failure.code}] ${failure.message}`
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Await async value.
  await prisma.inboundEmailEvent.update({
    //> Source statement or expression.
    where: { id: event.id },
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      status: "DEAD_LETTER",
      //> Source statement or expression.
      lastFailureCode: "PIPELINE_EXHAUSTED",
      //> Source statement or expression.
      lastFailureMessage: "Ingress retry loop exited without success."
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
  //> Return a value.
  return {
    //> Source statement or expression.
    accepted: false,
    //> Source statement or expression.
    status: "DEAD_LETTER" as IngressStatus,
    //> Source statement or expression.
    eventId: event.id,
    //> Source statement or expression.
    reason: "Ingress retry loop exhausted."
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
