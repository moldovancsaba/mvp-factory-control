const RISK_RANK = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const DANGEROUS_SHELL_PATTERNS = [
  /\brm\s+-rf\s+\/\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:?/i
];

function maxRisk(a, b) {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function readShellCommand(call) {
  const args = call?.args && typeof call.args === "object" ? call.args : {};
  const command =
    typeof args.command === "string"
      ? args.command
      : typeof args.cmd === "string"
      ? args.cmd
      : "";
  return String(command || "").trim();
}

function denyUnknownTool(call) {
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

function classifyCall(call) {
  const base = {
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

  if (/^filesystem\.(read|list|stat|search)$/.test(call.tool)) {
    const effectiveRiskClass = maxRisk("MEDIUM", call.riskClass);
    const requiresApproval =
      base.requiresApproval || effectiveRiskClass === "HIGH" || effectiveRiskClass === "CRITICAL";
    return {
      ...base,
      policyClass: "FILESYSTEM_READ",
      effectiveRiskClass,
      requiresApproval,
      allowed: true,
      reason: requiresApproval
        ? "filesystem read/search escalated to approval-required execution."
        : "filesystem read/search allowed by policy."
    };
  }

  if (/^filesystem\.(write|patch|edit|delete|move|mkdir|copy)$/.test(call.tool)) {
    const effectiveRiskClass = maxRisk("HIGH", call.riskClass);
    return {
      ...base,
      policyClass: "FILESYSTEM_MUTATION",
      effectiveRiskClass,
      requiresApproval: true,
      allowed: true,
      reason: "filesystem mutation allowed only with explicit approval token."
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
      allowed: true,
      reason: requiresApproval
        ? "git read operation escalated to approval-required execution."
        : "git read operation allowed by policy."
    };
  }

  if (/^git\.(add|commit|push|checkout|pr\.create)$/.test(call.tool)) {
    const effectiveRiskClass = maxRisk("HIGH", call.riskClass);
    return {
      ...base,
      policyClass: "GIT_MUTATION",
      effectiveRiskClass,
      requiresApproval: true,
      allowed: true,
      reason: "git mutation allowed only with explicit approval token and branch safety checks."
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
      allowed: true,
      reason: "shell.exec allowed only with explicit approval token and runtime safeguards."
    };
  }

  return denyUnknownTool(call);
}

function evaluateToolCommandPolicy(envelope) {
  const decisions = Array.isArray(envelope?.calls)
    ? envelope.calls.map((call) => classifyCall(call))
    : [];
  const denied = decisions.find((decision) => !decision.allowed) || null;
  const approvalDecision = decisions.find((decision) => decision.requiresApproval) || null;
  const highestRiskClass = decisions.reduce(
    (acc, decision) => maxRisk(acc, decision.effectiveRiskClass),
    "LOW"
  );
  return {
    allowed: denied === null,
    requiresApproval: approvalDecision !== null,
    denyReason: denied ? denied.reason : null,
    approvalReason: approvalDecision
      ? `Approval required by policy class ${approvalDecision.policyClass}.`
      : null,
    highestRiskClass,
    decisions
  };
}

function summarizeToolCommandPolicyEvaluation(evaluation) {
  return {
    allowed: evaluation.allowed,
    requiresApproval: evaluation.requiresApproval,
    denyReason: evaluation.denyReason,
    approvalReason: evaluation.approvalReason,
    highestRiskClass: evaluation.highestRiskClass,
    decisions: (evaluation.decisions || []).map((decision) => ({
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

module.exports = {
  evaluateToolCommandPolicy,
  summarizeToolCommandPolicyEvaluation
};
