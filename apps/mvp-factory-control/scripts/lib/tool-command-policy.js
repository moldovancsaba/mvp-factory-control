/**
 * CommonJS port of `src/lib/tool-command-policy.ts` for the Node worker. Keep allowlists/denylists in sync.
 */
//> Variable declaration.
const RISK_RANK = {
  //> Source statement or expression.
  LOW: 1,
  //> Source statement or expression.
  MEDIUM: 2,
  //> Source statement or expression.
  HIGH: 3,
  //> Source statement or expression.
  CRITICAL: 4
//> Brace or statement terminator.
};

//> Variable declaration.
const DANGEROUS_SHELL_PATTERNS = [
  //> Source statement or expression.
  /\brm\s+-rf\s+\/\b/i,
  //> Source statement or expression.
  /\bmkfs\b/i,
  //> Source statement or expression.
  /\bdd\s+if=/i,
  //> Source statement or expression.
  /\bshutdown\b/i,
  //> Source statement or expression.
  /\breboot\b/i,
  //> Source statement or expression.
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:?/i
//> Delimiter or separator.
];

//> Function declaration.
function maxRisk(a, b) {
  //> Return a value.
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
//> Brace or statement terminator.
}

//> Function declaration.
function readShellCommand(call) {
  //> Variable declaration.
  const args = call?.args && typeof call.args === "object" ? call.args : {};
  //> Variable declaration.
  const command =
    //> Source statement or expression.
    typeof args.command === "string"
      //> Source statement or expression.
      ? args.command
      //> Source statement or expression.
      : typeof args.cmd === "string"
      //> Source statement or expression.
      ? args.cmd
      //> Source statement or expression.
      : "";
  //> Return a value.
  return String(command || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function denyUnknownTool(call) {
  //> Return a value.
  return {
    //> Source statement or expression.
    callId: call.id,
    //> Source statement or expression.
    tool: call.tool,
    //> Source statement or expression.
    policyClass: "UNKNOWN_TOOL",
    //> Source statement or expression.
    riskClass: call.riskClass,
    //> Source statement or expression.
    effectiveRiskClass: "CRITICAL",
    //> Source statement or expression.
    requiresApproval: true,
    //> Source statement or expression.
    allowed: false,
    //> Source statement or expression.
    reason: `Tool ${call.tool} is not allowlisted by command policy (deny-by-default).`
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function classifyCall(call) {
  //> Variable declaration.
  const base = {
    //> Source statement or expression.
    callId: call.id,
    //> Source statement or expression.
    tool: call.tool,
    //> Source statement or expression.
    riskClass: call.riskClass,
    //> Source statement or expression.
    effectiveRiskClass: call.riskClass,
    //> Source statement or expression.
    requiresApproval: call.approval === "HUMAN_APPROVAL"
  //> Brace or statement terminator.
  };

  //> Conditional branch.
  if (call.tool === "chat.respond") {
    //> Variable declaration.
    const effectiveRiskClass = maxRisk("LOW", call.riskClass);
    //> Variable declaration.
    const requiresApproval =
      //> Source statement or expression.
      base.requiresApproval || effectiveRiskClass === "HIGH" || effectiveRiskClass === "CRITICAL";
    //> Return a value.
    return {
      //> Source statement or expression.
      ...base,
      //> Source statement or expression.
      policyClass: "CHAT_RESPONSE",
      //> Source statement or expression.
      effectiveRiskClass,
      //> Source statement or expression.
      requiresApproval,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: requiresApproval
        //> Source statement or expression.
        ? "chat.respond escalated to approval-required execution."
        //> Source statement or expression.
        : "chat.respond allowed by policy."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (/^filesystem\.(read|list|stat|search)$/.test(call.tool)) {
    //> Variable declaration.
    const effectiveRiskClass = maxRisk("MEDIUM", call.riskClass);
    //> Variable declaration.
    const requiresApproval =
      //> Source statement or expression.
      base.requiresApproval || effectiveRiskClass === "HIGH" || effectiveRiskClass === "CRITICAL";
    //> Return a value.
    return {
      //> Source statement or expression.
      ...base,
      //> Source statement or expression.
      policyClass: "FILESYSTEM_READ",
      //> Source statement or expression.
      effectiveRiskClass,
      //> Source statement or expression.
      requiresApproval,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: requiresApproval
        //> Source statement or expression.
        ? "filesystem read/search escalated to approval-required execution."
        //> Source statement or expression.
        : "filesystem read/search allowed by policy."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (/^filesystem\.(write|patch|edit|delete|move|mkdir|copy)$/.test(call.tool)) {
    //> Variable declaration.
    const effectiveRiskClass = maxRisk("HIGH", call.riskClass);
    //> Return a value.
    return {
      //> Source statement or expression.
      ...base,
      //> Source statement or expression.
      policyClass: "FILESYSTEM_MUTATION",
      //> Source statement or expression.
      effectiveRiskClass,
      //> Source statement or expression.
      requiresApproval: true,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: "filesystem mutation allowed only with explicit approval token."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (/^git\.(status|diff|log|show|branch\.list)$/.test(call.tool)) {
    //> Variable declaration.
    const effectiveRiskClass = maxRisk("MEDIUM", call.riskClass);
    //> Variable declaration.
    const requiresApproval =
      //> Source statement or expression.
      base.requiresApproval || effectiveRiskClass === "HIGH" || effectiveRiskClass === "CRITICAL";
    //> Return a value.
    return {
      //> Source statement or expression.
      ...base,
      //> Source statement or expression.
      policyClass: "GIT_READ",
      //> Source statement or expression.
      effectiveRiskClass,
      //> Source statement or expression.
      requiresApproval,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: requiresApproval
        //> Source statement or expression.
        ? "git read operation escalated to approval-required execution."
        //> Source statement or expression.
        : "git read operation allowed by policy."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (/^git\.(add|commit|push|checkout|pr\.create)$/.test(call.tool)) {
    //> Variable declaration.
    const effectiveRiskClass = maxRisk("HIGH", call.riskClass);
    //> Return a value.
    return {
      //> Source statement or expression.
      ...base,
      //> Source statement or expression.
      policyClass: "GIT_MUTATION",
      //> Source statement or expression.
      effectiveRiskClass,
      //> Source statement or expression.
      requiresApproval: true,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: "git mutation allowed only with explicit approval token and branch safety checks."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (call.tool === "shell.exec") {
    //> Variable declaration.
    const command = readShellCommand(call);
    //> Variable declaration.
    const effectiveRiskClass = maxRisk("CRITICAL", call.riskClass);
    //> Variable declaration.
    const dangerousPattern = DANGEROUS_SHELL_PATTERNS.find((pattern) => pattern.test(command));
    //> Conditional branch.
    if (dangerousPattern) {
      //> Return a value.
      return {
        //> Source statement or expression.
        ...base,
        //> Source statement or expression.
        policyClass: "SHELL_EXECUTION",
        //> Source statement or expression.
        effectiveRiskClass,
        //> Source statement or expression.
        requiresApproval: true,
        //> Source statement or expression.
        allowed: false,
        //> Source statement or expression.
        reason: "shell.exec matches a blocked high-risk pattern (deny-by-default)."
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }
    //> Return a value.
    return {
      //> Source statement or expression.
      ...base,
      //> Source statement or expression.
      policyClass: "SHELL_EXECUTION",
      //> Source statement or expression.
      effectiveRiskClass,
      //> Source statement or expression.
      requiresApproval: true,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: "shell.exec allowed only with explicit approval token and runtime safeguards."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return denyUnknownTool(call);
//> Brace or statement terminator.
}

//> Function declaration.
function evaluateToolCommandPolicy(envelope) {
  //> Variable declaration.
  const decisions = Array.isArray(envelope?.calls)
    //> Source statement or expression.
    ? envelope.calls.map((call) => classifyCall(call))
    //> Source statement or expression.
    : [];
  //> Variable declaration.
  const denied = decisions.find((decision) => !decision.allowed) || null;
  //> Variable declaration.
  const approvalDecision = decisions.find((decision) => decision.requiresApproval) || null;
  //> Variable declaration.
  const highestRiskClass = decisions.reduce(
    //> Source statement or expression.
    (acc, decision) => maxRisk(acc, decision.effectiveRiskClass),
    //> String literal line.
    "LOW"
  //> Delimiter or separator.
  );
  //> Return a value.
  return {
    //> Source statement or expression.
    allowed: denied === null,
    //> Source statement or expression.
    requiresApproval: approvalDecision !== null,
    //> Source statement or expression.
    denyReason: denied ? denied.reason : null,
    //> Source statement or expression.
    approvalReason: approvalDecision
      //> Source statement or expression.
      ? `Approval required by policy class ${approvalDecision.policyClass}.`
      //> Source statement or expression.
      : null,
    //> Source statement or expression.
    highestRiskClass,
    //> Source statement or expression.
    decisions
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function summarizeToolCommandPolicyEvaluation(evaluation) {
  //> Return a value.
  return {
    //> Source statement or expression.
    allowed: evaluation.allowed,
    //> Source statement or expression.
    requiresApproval: evaluation.requiresApproval,
    //> Source statement or expression.
    denyReason: evaluation.denyReason,
    //> Source statement or expression.
    approvalReason: evaluation.approvalReason,
    //> Source statement or expression.
    highestRiskClass: evaluation.highestRiskClass,
    //> Source statement or expression.
    decisions: (evaluation.decisions || []).map((decision) => ({
      //> Source statement or expression.
      callId: decision.callId,
      //> Source statement or expression.
      tool: decision.tool,
      //> Source statement or expression.
      policyClass: decision.policyClass,
      //> Source statement or expression.
      riskClass: decision.riskClass,
      //> Source statement or expression.
      effectiveRiskClass: decision.effectiveRiskClass,
      //> Source statement or expression.
      requiresApproval: decision.requiresApproval,
      //> Source statement or expression.
      allowed: decision.allowed,
      //> Source statement or expression.
      reason: decision.reason
    //> Delimiter or separator.
    }))
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Source statement or expression.
module.exports = {
  //> Source statement or expression.
  evaluateToolCommandPolicy,
  //> Source statement or expression.
  summarizeToolCommandPolicyEvaluation
//> Brace or statement terminator.
};
