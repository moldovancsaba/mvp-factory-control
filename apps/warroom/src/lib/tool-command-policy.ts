import type {
  ToolCallDefinition,
  ToolCallProtocolEnvelope,
  ToolCallRiskClass
} from "@/lib/tool-call-protocol";

const RISK_RANK: Record<ToolCallRiskClass, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const DANGEROUS_SHELL_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:?/
];

export type ToolCommandPolicyClass =
  | "CHAT_RESPONSE"
  | "FILESYSTEM_READ"
  | "FILESYSTEM_MUTATION"
  | "GIT_READ"
  | "GIT_MUTATION"
  | "SHELL_EXECUTION"
  | "UNKNOWN_TOOL";

export type ToolCommandPolicyDecision = {
  callId: string;
  tool: string;
  policyClass: ToolCommandPolicyClass;
  riskClass: ToolCallRiskClass;
  effectiveRiskClass: ToolCallRiskClass;
  requiresApproval: boolean;
  allowed: boolean;
  reason: string;
};

export type ToolCommandPolicyEvaluation = {
  allowed: boolean;
  requiresApproval: boolean;
  denyReason: string | null;
  approvalReason: string | null;
  highestRiskClass: ToolCallRiskClass;
  decisions: ToolCommandPolicyDecision[];
};

function maxRisk(a: ToolCallRiskClass, b: ToolCallRiskClass): ToolCallRiskClass {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function readShellCommand(call: ToolCallDefinition): string {
  const args = call.args || {};
  const command =
    typeof args.command === "string"
      ? args.command
      : typeof args.cmd === "string"
      ? args.cmd
      : "";
  return command.trim();
}

function denyUnknownTool(call: ToolCallDefinition): ToolCommandPolicyDecision {
  return {
    callId: call.id,
    tool: call.tool,
    policyClass: "UNKNOWN_TOOL",
    riskClass: call.riskClass,
    effectiveRiskClass: "CRITICAL",
    requiresApproval: true,
    allowed: false,
    reason: `Tool ${call.tool} is not allowlisted by command policy (deny-by-default).`
  };
}

function classifyCall(call: ToolCallDefinition): ToolCommandPolicyDecision {
  const base: Omit<ToolCommandPolicyDecision, "policyClass" | "allowed" | "reason"> = {
    callId: call.id,
    tool: call.tool,
    riskClass: call.riskClass,
    effectiveRiskClass: call.riskClass,
    requiresApproval: call.approval === "HUMAN_APPROVAL"
  };

  if (call.tool === "chat.respond") {
    const effectiveRiskClass = maxRisk("LOW", call.riskClass);
    const requiresApproval =
      base.requiresApproval || effectiveRiskClass === "HIGH" || effectiveRiskClass === "CRITICAL";
    return {
      ...base,
      policyClass: "CHAT_RESPONSE",
      effectiveRiskClass,
      requiresApproval,
      allowed: true,
      reason: requiresApproval
        ? "chat.respond escalated to approval-required execution."
        : "chat.respond allowed by policy."
    };
  }

  if (/^filesystem\.(read|list|stat)$/.test(call.tool)) {
    const effectiveRiskClass = maxRisk("MEDIUM", call.riskClass);
    const requiresApproval =
      base.requiresApproval || effectiveRiskClass === "HIGH" || effectiveRiskClass === "CRITICAL";
    return {
      ...base,
      policyClass: "FILESYSTEM_READ",
      effectiveRiskClass,
      requiresApproval,
      allowed: false,
      reason: `Policy class FILESYSTEM_READ is defined but runtime tool is not enabled in this phase.`
    };
  }

  if (/^filesystem\.(write|patch|delete|move|mkdir|copy)$/.test(call.tool)) {
    const effectiveRiskClass = maxRisk("HIGH", call.riskClass);
    return {
      ...base,
      policyClass: "FILESYSTEM_MUTATION",
      effectiveRiskClass,
      requiresApproval: true,
      allowed: false,
      reason:
        "Policy class FILESYSTEM_MUTATION is defined and approval-gated, but runtime execution is disabled in this phase."
    };
  }

  if (/^git\.(status|diff|log|show|branch\.list)$/.test(call.tool)) {
    const effectiveRiskClass = maxRisk("MEDIUM", call.riskClass);
    const requiresApproval =
      base.requiresApproval || effectiveRiskClass === "HIGH" || effectiveRiskClass === "CRITICAL";
    return {
      ...base,
      policyClass: "GIT_READ",
      effectiveRiskClass,
      requiresApproval,
      allowed: false,
      reason: "Policy class GIT_READ is defined but runtime tool is not enabled in this phase."
    };
  }

  if (/^git\.(add|commit|push|checkout|merge|rebase|pr\.create)$/.test(call.tool)) {
    const effectiveRiskClass = maxRisk("HIGH", call.riskClass);
    return {
      ...base,
      policyClass: "GIT_MUTATION",
      effectiveRiskClass,
      requiresApproval: true,
      allowed: false,
      reason:
        "Policy class GIT_MUTATION is defined and approval-gated, but runtime execution is disabled in this phase."
    };
  }

  if (call.tool === "shell.exec") {
    const command = readShellCommand(call);
    const effectiveRiskClass = maxRisk("CRITICAL", call.riskClass);
    const dangerousPattern = DANGEROUS_SHELL_PATTERNS.find((pattern) => pattern.test(command));
    if (dangerousPattern) {
      return {
        ...base,
        policyClass: "SHELL_EXECUTION",
        effectiveRiskClass,
        requiresApproval: true,
        allowed: false,
        reason: "shell.exec matches a blocked high-risk pattern (deny-by-default)."
      };
    }
    return {
      ...base,
      policyClass: "SHELL_EXECUTION",
      effectiveRiskClass,
      requiresApproval: true,
      allowed: false,
      reason:
        "Policy class SHELL_EXECUTION is defined and approval-gated, but runtime execution is disabled in this phase."
    };
  }

  return denyUnknownTool(call);
}

export function evaluateToolCommandPolicy(
  envelope: ToolCallProtocolEnvelope
): ToolCommandPolicyEvaluation {
  const decisions = envelope.calls.map((call) => classifyCall(call));
  const denied = decisions.find((decision) => !decision.allowed) || null;
  const approvalDecision = decisions.find((decision) => decision.requiresApproval) || null;
  const highestRiskClass = decisions.reduce<ToolCallRiskClass>(
    (acc, decision) => maxRisk(acc, decision.effectiveRiskClass),
    "LOW"
  );
  return {
    allowed: denied === null,
    requiresApproval: approvalDecision !== null,
    denyReason: denied?.reason || null,
    approvalReason: approvalDecision
      ? `Approval required by policy class ${approvalDecision.policyClass}.`
      : null,
    highestRiskClass,
    decisions
  };
}

export function summarizeToolCommandPolicyEvaluation(evaluation: ToolCommandPolicyEvaluation) {
  return {
    allowed: evaluation.allowed,
    requiresApproval: evaluation.requiresApproval,
    denyReason: evaluation.denyReason,
    approvalReason: evaluation.approvalReason,
    highestRiskClass: evaluation.highestRiskClass,
    decisions: evaluation.decisions.map((decision) => ({
      callId: decision.callId,
      tool: decision.tool,
      policyClass: decision.policyClass,
      riskClass: decision.riskClass,
      effectiveRiskClass: decision.effectiveRiskClass,
      requiresApproval: decision.requiresApproval,
      allowed: decision.allowed,
      reason: decision.reason
    }))
  };
}
