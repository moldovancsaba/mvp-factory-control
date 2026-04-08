/**
 * Task and agent lifecycle **policy** (pure rules) plus audit recording to Prisma.
 *
 * `evaluateTaskTransition` / `evaluateAgentReadinessTransition` return allow/deny with reasons.
 * `recordLifecycleAudit` persists `LifecycleAuditEvent` rows. Used by `tasks.ts`, workers, and admin flows.
 */
//> Import bindings from a module.
import type { AgentReadiness, Prisma, TaskStatus } from "@prisma/client";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";

//> Export declaration.
export type ActorRole = "ORCHESTRATOR" | "ADMIN_OVERRIDE" | "HUMAN_OPERATOR" | "WORKER";

//> Export declaration.
export type TaskLifecycleAction =
  //> Source statement or expression.
  | "ENQUEUE_TASK"
  //> Source statement or expression.
  | "ROUTE_HANDOFF_TASK"
  //> Source statement or expression.
  | "CLAIM_TASK"
  //> Source statement or expression.
  | "COMPLETE_TASK"
  //> Source statement or expression.
  | "RETRY_TASK"
  //> Source statement or expression.
  | "DEAD_LETTER_TASK"
  //> Source statement or expression.
  | "RECOVER_STALE_RUNNING"
  //> Source statement or expression.
  | "FORCE_MANUAL_REQUIRED";

//> Export declaration.
export type AgentLifecycleAction = "SET_READINESS" | "ADMIN_SET_READINESS";

//> Export declaration.
export type TransitionDecision = {
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  reason: string;
//> Brace or statement terminator.
};

//> Type or interface definition.
type LifecycleDb = Prisma.TransactionClient | typeof prisma;

//> Function declaration.
function ok(reason: string): TransitionDecision {
  //> Return a value.
  return { allowed: true, reason };
//> Brace or statement terminator.
}

//> Function declaration.
function deny(reason: string): TransitionDecision {
  //> Return a value.
  return { allowed: false, reason };
//> Brace or statement terminator.
}

//> Export declaration.
export function evaluateTaskTransition(params: {
  //> Source statement or expression.
  actorRole: ActorRole;
  //> Source statement or expression.
  action: TaskLifecycleAction;
  //> Source statement or expression.
  fromState: TaskStatus | null;
  //> Source statement or expression.
  toState: TaskStatus;
//> Source statement or expression.
}): TransitionDecision {
  //> Variable declaration.
  const { actorRole, action, fromState, toState } = params;

  //> Conditional branch.
  if (actorRole === "ORCHESTRATOR") {
    //> Conditional branch.
    if (action === "ENQUEUE_TASK" || action === "ROUTE_HANDOFF_TASK") {
      //> Conditional branch.
      if (fromState !== null) {
        //> Return a value.
        return deny("Task creation transitions must have fromState=null.");
      //> Brace or statement terminator.
      }
      //> Conditional branch.
      if (toState === "QUEUED" || toState === "MANUAL_REQUIRED") {
        //> Return a value.
        return ok("Orchestrator task creation transition allowed.");
      //> Brace or statement terminator.
      }
      //> Return a value.
      return deny("Orchestrator task creation can only target QUEUED or MANUAL_REQUIRED.");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (action === "CLAIM_TASK") {
      //> Return a value.
      return fromState === "QUEUED" && toState === "RUNNING"
        //> Source statement or expression.
        ? ok("Orchestrator claim transition allowed.")
        //> Source statement or expression.
        : deny("Claim transition requires QUEUED -> RUNNING.");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (action === "COMPLETE_TASK") {
      //> Return a value.
      return fromState === "RUNNING" && toState === "DONE"
        //> Source statement or expression.
        ? ok("Orchestrator completion transition allowed.")
        //> Source statement or expression.
        : deny("Completion transition requires RUNNING -> DONE.");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (action === "RETRY_TASK") {
      //> Return a value.
      return fromState === "RUNNING" && toState === "QUEUED"
        //> Source statement or expression.
        ? ok("Orchestrator retry transition allowed.")
        //> Source statement or expression.
        : deny("Retry transition requires RUNNING -> QUEUED.");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (action === "DEAD_LETTER_TASK") {
      //> Return a value.
      return fromState === "RUNNING" && toState === "DEAD_LETTER"
        //> Source statement or expression.
        ? ok("Orchestrator dead-letter transition allowed.")
        //> Source statement or expression.
        : deny("Dead-letter transition requires RUNNING -> DEAD_LETTER.");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (action === "RECOVER_STALE_RUNNING") {
      //> Return a value.
      return fromState === "RUNNING" && toState === "QUEUED"
        //> Source statement or expression.
        ? ok("Stale-running recovery transition allowed.")
        //> Source statement or expression.
        : deny("Stale-running recovery requires RUNNING -> QUEUED.");
    //> Brace or statement terminator.
    }
    //> Return a value.
    return deny(`Unsupported orchestrator task action: ${action}.`);
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (actorRole === "HUMAN_OPERATOR") {
    //> Conditional branch.
    if (action !== "ENQUEUE_TASK") {
      //> Return a value.
      return deny(`Human operator cannot perform task action ${action}.`);
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (fromState !== null) {
      //> Return a value.
      return deny("Human enqueue requires fromState=null.");
    //> Brace or statement terminator.
    }
    //> Return a value.
    return toState === "QUEUED" || toState === "MANUAL_REQUIRED"
      //> Source statement or expression.
      ? ok("Human enqueue transition allowed.")
      //> Source statement or expression.
      : deny("Human enqueue can only target QUEUED or MANUAL_REQUIRED.");
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (actorRole === "ADMIN_OVERRIDE") {
    //> Conditional branch.
    if (action !== "FORCE_MANUAL_REQUIRED") {
      //> Return a value.
      return deny(`Admin override cannot perform task action ${action}.`);
    //> Brace or statement terminator.
    }
    //> Return a value.
    return fromState === "QUEUED" || fromState === "RUNNING"
      //> Source statement or expression.
      ? toState === "MANUAL_REQUIRED"
        //> Source statement or expression.
        ? ok("Admin override manual-required transition allowed.")
        //> Source statement or expression.
        : deny("Admin override can only target MANUAL_REQUIRED.")
      //> Source statement or expression.
      : deny("Admin override manual-required requires QUEUED or RUNNING source.");
  //> Brace or statement terminator.
  }

  //> Return a value.
  return deny("Worker role cannot mutate task lifecycle directly.");
//> Brace or statement terminator.
}

//> Export declaration.
export function evaluateAgentReadinessTransition(params: {
  //> Source statement or expression.
  actorRole: ActorRole;
  //> Source statement or expression.
  action: AgentLifecycleAction;
  //> Source statement or expression.
  fromState: AgentReadiness;
  //> Source statement or expression.
  toState: AgentReadiness;
//> Source statement or expression.
}): TransitionDecision {
  //> Variable declaration.
  const { actorRole, action, fromState, toState } = params;
  //> Conditional branch.
  if (fromState === toState) return ok("No-op readiness transition allowed.");

  //> Conditional branch.
  if (actorRole === "HUMAN_OPERATOR") {
    //> Conditional branch.
    if (action !== "SET_READINESS") {
      //> Return a value.
      return deny(`Human operator cannot perform agent action ${action}.`);
    //> Brace or statement terminator.
    }
    //> Return a value.
    return ok("Human readiness transition allowed.");
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (actorRole === "ADMIN_OVERRIDE") {
    //> Conditional branch.
    if (action !== "ADMIN_SET_READINESS") {
      //> Return a value.
      return deny(`Admin override cannot perform agent action ${action}.`);
    //> Brace or statement terminator.
    }
    //> Return a value.
    return ok("Admin override readiness transition allowed.");
  //> Brace or statement terminator.
  }

  //> Return a value.
  return deny(`Role ${actorRole} is not allowed to mutate agent readiness.`);
//> Brace or statement terminator.
}

//> Export declaration.
export async function recordLifecycleAudit(params: {
  //> Source statement or expression.
  entityType: "TASK" | "AGENT";
  //> Source statement or expression.
  entityId?: string | null;
  //> Source statement or expression.
  actorRole: ActorRole;
  //> Source statement or expression.
  action: string;
  //> Source statement or expression.
  fromState?: string | null;
  //> Source statement or expression.
  toState?: string | null;
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  metadata?: unknown;
  //> Source statement or expression.
  db?: LifecycleDb;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const db = params.db ?? prisma;
  //> Await async value.
  await db.lifecycleAuditEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      entityType: params.entityType,
      //> Source statement or expression.
      entityId: params.entityId ?? null,
      //> Source statement or expression.
      actorRole: params.actorRole,
      //> Source statement or expression.
      action: params.action,
      //> Source statement or expression.
      fromState: params.fromState ?? null,
      //> Source statement or expression.
      toState: params.toState ?? null,
      //> Source statement or expression.
      allowed: params.allowed,
      //> Source statement or expression.
      reason: params.reason,
      //> Source statement or expression.
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export function permissionMatrixRows() {
  //> Return a value.
  return [
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      role: "ORCHESTRATOR",
      //> Source statement or expression.
      allowed: "Claim/complete/retry/dead-letter/recover task lifecycle while lease is active.",
      //> Source statement or expression.
      denied: "Readiness/admin override mutations."
    //> Brace or statement terminator.
    },
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      role: "ADMIN_OVERRIDE",
      //> Source statement or expression.
      allowed: "Force MANUAL_REQUIRED transitions and explicit readiness overrides.",
      //> Source statement or expression.
      denied: "Autonomous dispatch/claim/complete paths."
    //> Brace or statement terminator.
    },
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      role: "HUMAN_OPERATOR",
      //> Source statement or expression.
      allowed: "Enqueue tasks and set readiness through normal controls.",
      //> Source statement or expression.
      denied: "Direct RUNNING/DONE/DEAD_LETTER lifecycle writes."
    //> Brace or statement terminator.
    },
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      role: "WORKER",
      //> Source statement or expression.
      allowed: "Execute runtime calls only through orchestrator authority path.",
      //> Source statement or expression.
      denied: "Independent lifecycle mutations."
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  ];
//> Brace or statement terminator.
}
