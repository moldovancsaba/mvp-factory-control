/**
 * Pre-enqueue **judgement** for tasks: agent readiness, runtime, and ALPHA/BETA control boundary.
 *
 * `evaluateTaskJudgementGate` returns QUEUED vs MANUAL_REQUIRED with structured `checks`. BETA agents
 * are blocked for “control intent” titles (heuristic regex). Exported reason strings are stable UI copy.
 */
//> Type or interface definition.
type AgentJudgementSnapshot = {
  //> Source statement or expression.
  enabled: boolean;
  //> Source statement or expression.
  runtime: "MANUAL" | "LOCAL" | "CLOUD";
  //> Source statement or expression.
  readiness: "NOT_READY" | "READY" | "PAUSED";
  //> Source statement or expression.
  controlRole: "ALPHA" | "BETA";
//> Brace or statement terminator.
};

//> Type or interface definition.
type JudgementGateSeverity = "BLOCK" | "INFO";

//> Export declaration.
export type JudgementGateCheck = {
  //> Source statement or expression.
  policyId: string;
  //> Source statement or expression.
  passed: boolean;
  //> Source statement or expression.
  severity: JudgementGateSeverity;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  evidence: Record<string, unknown>;
//> Brace or statement terminator.
};

//> Export declaration.
export type JudgementGateDecision = {
  //> Source statement or expression.
  policyVersion: "judgement-gates-v1";
  //> Source statement or expression.
  decision: "GO" | "NO_GO";
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  status: "QUEUED" | "MANUAL_REQUIRED";
  //> Source statement or expression.
  error: string | null;
  //> Source statement or expression.
  controlBoundaryDenied: boolean;
  //> Source statement or expression.
  summary: string;
  //> Source statement or expression.
  checks: JudgementGateCheck[];
//> Brace or statement terminator.
};

//> Export declaration.
export const AGENT_NOT_READY_REASON =
  //> String literal line.
  "Agent readiness is NOT_READY. Complete the readiness checklist and switch the agent to READY.";
//> Export declaration.
export const AGENT_PAUSED_REASON =
  //> String literal line.
  "Agent readiness is PAUSED. Task is queued and will execute after switching back to READY.";
//> Export declaration.
export const CONTROL_INTENT_BETA_REASON =
  //> String literal line.
  "Control-intent task denied for BETA role. Route strategic/control requests to an ALPHA agent.";

//> Function declaration.
function isControlIntent(text: string) {
  //> Variable declaration.
  const raw = String(text || "").toLowerCase();
  //> Return a value.
  return /\b(plan|decompose|delegate|assign|coordinate|priorit|strategy|roadmap)\b/.test(
    //> Source statement or expression.
    raw
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Export declaration.
export function evaluateTaskJudgementGate(input: {
  //> Source statement or expression.
  agentKey: string;
  //> Source statement or expression.
  title: string;
  //> Source statement or expression.
  agent: AgentJudgementSnapshot | null;
//> Source statement or expression.
}): JudgementGateDecision {
  //> Variable declaration.
  const checks: JudgementGateCheck[] = [];
  //> Variable declaration.
  const trimmedTitle = String(input.title || "").trim();
  //> Variable declaration.
  const controlIntent = isControlIntent(trimmedTitle);

  //> Source statement or expression.
  checks.push({
    //> Source statement or expression.
    policyId: "TITLE_NON_EMPTY",
    //> Source statement or expression.
    passed: Boolean(trimmedTitle),
    //> Source statement or expression.
    severity: "BLOCK",
    //> Source statement or expression.
    reason: trimmedTitle ? "Task title is present." : "Task title is empty.",
    //> Source statement or expression.
    evidence: {
      //> Source statement or expression.
      titleLength: trimmedTitle.length
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const agent = input.agent;
  //> Source statement or expression.
  checks.push({
    //> Source statement or expression.
    policyId: "AGENT_REGISTERED",
    //> Source statement or expression.
    passed: Boolean(agent),
    //> Source statement or expression.
    severity: "BLOCK",
    //> Source statement or expression.
    reason: agent ? `Agent @${input.agentKey} is registered.` : `Agent @${input.agentKey} is not registered in War Room.`,
    //> Source statement or expression.
    evidence: {
      //> Source statement or expression.
      agentKey: input.agentKey,
      //> Source statement or expression.
      exists: Boolean(agent)
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Conditional branch.
  if (agent) {
    //> Source statement or expression.
    checks.push({
      //> Source statement or expression.
      policyId: "CONTROL_INTENT_ALPHA_ONLY",
      //> Source statement or expression.
      passed: !(controlIntent && agent.controlRole === "BETA"),
      //> Source statement or expression.
      severity: "BLOCK",
      //> Source statement or expression.
      reason:
        //> Source statement or expression.
        controlIntent && agent.controlRole === "BETA"
          //> Source statement or expression.
          ? CONTROL_INTENT_BETA_REASON
          //> Source statement or expression.
          : "Control-intent boundary check passed.",
      //> Source statement or expression.
      evidence: {
        //> Source statement or expression.
        controlIntent,
        //> Source statement or expression.
        controlRole: agent.controlRole
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Source statement or expression.
    checks.push({
      //> Source statement or expression.
      policyId: "AGENT_ENABLED",
      //> Source statement or expression.
      passed: agent.enabled,
      //> Source statement or expression.
      severity: "BLOCK",
      //> Source statement or expression.
      reason: agent.enabled ? `Agent @${input.agentKey} is enabled.` : `Agent @${input.agentKey} is disabled.`,
      //> Source statement or expression.
      evidence: {
        //> Source statement or expression.
        enabled: agent.enabled
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Source statement or expression.
    checks.push({
      //> Source statement or expression.
      policyId: "RUNTIME_AUTONOMOUS",
      //> Source statement or expression.
      passed: agent.runtime === "LOCAL" || agent.runtime === "CLOUD",
      //> Source statement or expression.
      severity: "BLOCK",
      //> Source statement or expression.
      reason:
        //> Source statement or expression.
        agent.runtime === "LOCAL" || agent.runtime === "CLOUD"
          //> Source statement or expression.
          ? `Agent runtime ${agent.runtime} is runnable.`
          //> Source statement or expression.
          : `Agent @${input.agentKey} uses MANUAL runtime and cannot execute automatically.`,
      //> Source statement or expression.
      evidence: {
        //> Source statement or expression.
        runtime: agent.runtime
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Source statement or expression.
    checks.push({
      //> Source statement or expression.
      policyId: "READINESS_NOT_READY_BLOCK",
      //> Source statement or expression.
      passed: agent.readiness !== "NOT_READY",
      //> Source statement or expression.
      severity: "BLOCK",
      //> Source statement or expression.
      reason:
        //> Source statement or expression.
        agent.readiness !== "NOT_READY"
          //> Source statement or expression.
          ? `Agent readiness is ${agent.readiness}.`
          //> Source statement or expression.
          : AGENT_NOT_READY_REASON,
      //> Source statement or expression.
      evidence: {
        //> Source statement or expression.
        readiness: agent.readiness
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Source statement or expression.
    checks.push({
      //> Source statement or expression.
      policyId: "READINESS_PAUSED_QUEUE_NOTE",
      //> Source statement or expression.
      passed: true,
      //> Source statement or expression.
      severity: "INFO",
      //> Source statement or expression.
      reason:
        //> Source statement or expression.
        agent.readiness === "PAUSED"
          //> Source statement or expression.
          ? AGENT_PAUSED_REASON
          //> Source statement or expression.
          : "Agent readiness does not require pause-note handling.",
      //> Source statement or expression.
      evidence: {
        //> Source statement or expression.
        readiness: agent.readiness
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const firstBlockingFailure = checks.find((check) => check.severity === "BLOCK" && !check.passed);
  //> Variable declaration.
  const allowed = !firstBlockingFailure;
  //> Variable declaration.
  const status: "QUEUED" | "MANUAL_REQUIRED" = allowed ? "QUEUED" : "MANUAL_REQUIRED";

  //> Variable declaration.
  let error: string | null = firstBlockingFailure ? firstBlockingFailure.reason : null;
  //> Conditional branch.
  if (!firstBlockingFailure && agent?.readiness === "PAUSED") {
    //> Source statement or expression.
    error = AGENT_PAUSED_REASON;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const controlBoundaryDenied = checks.some(
    //> Source statement or expression.
    (check) => check.policyId === "CONTROL_INTENT_ALPHA_ONLY" && check.passed === false
  //> Delimiter or separator.
  );

  //> Return a value.
  return {
    //> Source statement or expression.
    policyVersion: "judgement-gates-v1",
    //> Source statement or expression.
    decision: allowed ? "GO" : "NO_GO",
    //> Source statement or expression.
    allowed,
    //> Source statement or expression.
    status,
    //> Source statement or expression.
    error,
    //> Source statement or expression.
    controlBoundaryDenied,
    //> Source statement or expression.
    summary: allowed
      //> Source statement or expression.
      ? "Judgement gate GO: deterministic policy checks passed."
      //> Source statement or expression.
      : `Judgement gate NO_GO: ${firstBlockingFailure?.reason || "policy failure"}`,
    //> Source statement or expression.
    checks
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
