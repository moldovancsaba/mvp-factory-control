/**
 * Agent **readiness checklist** derived from Prisma `Agent` rows plus optional `AgentSetting` from JSON store.
 *
 * Computes checklist items (runtime config, API key env, heartbeat, smoke test) and blocking reasons for UI.
 * Reason strings mirror `judgement-gates` where overlap exists for consistent operator messaging.
 */
//> Import bindings from a module.
import type { Agent, AgentReadiness } from "@prisma/client";
//> Import bindings from a module.
import type { AgentSetting } from "@/lib/settings-store";

//> Export declaration.
export const AGENT_NOT_READY_REASON =
  //> String literal line.
  "Agent readiness is NOT_READY. Complete the readiness checklist and switch the agent to READY.";
//> Export declaration.
export const AGENT_PAUSED_REASON =
  //> String literal line.
  "Agent readiness is PAUSED. Task is queued and will execute after switching back to READY.";

//> Type or interface definition.
type ChecklistItemKey = "runtimeConfig" | "apiKeyEnv" | "heartbeat" | "smokeTest";

//> Export declaration.
export type ReadinessChecklistItem = {
  //> Source statement or expression.
  key: ChecklistItemKey;
  //> Source statement or expression.
  label: string;
  //> Source statement or expression.
  ok: boolean;
  //> Source statement or expression.
  detail: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type AgentReadinessChecklist = {
  //> Source statement or expression.
  items: ReadinessChecklistItem[];
  //> Source statement or expression.
  blockingReasons: string[];
  //> Source statement or expression.
  checklistReady: boolean;
//> Brace or statement terminator.
};

//> Function declaration.
function envOrEmpty(name: string) {
  //> Return a value.
  return String(process.env[name] || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function defaultConfigForAgent(agent: Pick<Agent, "key" | "runtime">) {
  //> Conditional branch.
  if (agent.runtime === "LOCAL") {
    //> Return a value.
    return {
      //> Source statement or expression.
      endpointEnv: "OLLAMA_BASE_URL",
      //> Source statement or expression.
      modelEnv: "OLLAMA_MODEL",
      //> Source statement or expression.
      apiKeyEnv: ""
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (agent.runtime === "CLOUD") {
    //> Return a value.
    return {
      //> Source statement or expression.
      endpointEnv: "OPENAI_BASE_URL",
      //> Source statement or expression.
      modelEnv: "OPENAI_MODEL",
      //> Source statement or expression.
      apiKeyEnv: "OPENAI_API_KEY"
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    endpointEnv: "",
    //> Source statement or expression.
    modelEnv: "",
    //> Source statement or expression.
    apiKeyEnv: ""
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function runtimeConfigChecklist(
  //> Source statement or expression.
  agent: Pick<Agent, "key" | "runtime" | "model" | "host">,
  //> Source statement or expression.
  cfg: AgentSetting | null
//> Source statement or expression.
): ReadinessChecklistItem {
  //> Conditional branch.
  if (agent.runtime === "MANUAL") {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "runtimeConfig",
      //> Source statement or expression.
      label: "Runtime config",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: "Runtime is MANUAL; no autonomous executor is wired."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const defaults = defaultConfigForAgent(agent);
  //> Variable declaration.
  const endpoint = cfg?.agentUrl || envOrEmpty(defaults.endpointEnv);
  //> Variable declaration.
  const model = cfg?.agentModel || agent.model || envOrEmpty(defaults.modelEnv);
  //> Variable declaration.
  const missing: string[] = [];
  //> Conditional branch.
  if (!endpoint) missing.push("endpoint");
  //> Conditional branch.
  if (!model) missing.push("model");
  //> Conditional branch.
  if (missing.length) {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "runtimeConfig",
      //> Source statement or expression.
      label: "Runtime config",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: `Missing ${missing.join(" + ")}.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    key: "runtimeConfig",
    //> Source statement or expression.
    label: "Runtime config",
    //> Source statement or expression.
    ok: true,
    //> Source statement or expression.
    detail: `${agent.runtime} endpoint/model present.`
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function apiKeyChecklist(
  //> Source statement or expression.
  agent: Pick<Agent, "key" | "runtime">,
  //> Source statement or expression.
  cfg: AgentSetting | null
//> Source statement or expression.
): ReadinessChecklistItem {
  //> Conditional branch.
  if (agent.runtime !== "CLOUD") {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "apiKeyEnv",
      //> Source statement or expression.
      label: "API key env",
      //> Source statement or expression.
      ok: true,
      //> Source statement or expression.
      detail: "Not required for non-CLOUD runtime."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const defaults = defaultConfigForAgent(agent);
  //> Variable declaration.
  const apiKeyEnv = cfg?.agentApiKeyEnv || defaults.apiKeyEnv;
  //> Conditional branch.
  if (!apiKeyEnv) {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "apiKeyEnv",
      //> Source statement or expression.
      label: "API key env",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: "No API key env var configured."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const hasValue = Boolean(envOrEmpty(apiKeyEnv));
  //> Return a value.
  return {
    //> Source statement or expression.
    key: "apiKeyEnv",
    //> Source statement or expression.
    label: "API key env",
    //> Source statement or expression.
    ok: hasValue,
    //> Source statement or expression.
    detail: hasValue
      //> Source statement or expression.
      ? `${apiKeyEnv} is present in environment.`
      //> Source statement or expression.
      : `${apiKeyEnv} is missing in environment.`
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function heartbeatChecklist(
  //> Source statement or expression.
  agent: Pick<Agent, "runtime" | "lastHeartbeatAt">,
  //> Source statement or expression.
  isRunning: boolean,
  //> Source statement or expression.
  nowMs: number
//> Source statement or expression.
): ReadinessChecklistItem {
  //> Conditional branch.
  if (agent.runtime === "MANUAL") {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "heartbeat",
      //> Source statement or expression.
      label: "Heartbeat",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: "No runnable worker is implemented for this agent yet."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!isRunning) {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "heartbeat",
      //> Source statement or expression.
      label: "Heartbeat",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: "Worker process is stopped."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!agent.lastHeartbeatAt) {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "heartbeat",
      //> Source statement or expression.
      label: "Heartbeat",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: "No heartbeat received yet."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const ageMs = nowMs - agent.lastHeartbeatAt.getTime();
  //> Conditional branch.
  if (ageMs > 60_000) {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "heartbeat",
      //> Source statement or expression.
      label: "Heartbeat",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: `Heartbeat is stale (${Math.round(ageMs / 1000)}s old).`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    key: "heartbeat",
    //> Source statement or expression.
    label: "Heartbeat",
    //> Source statement or expression.
    ok: true,
    //> Source statement or expression.
    detail: "Recent heartbeat received."
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function smokeTestChecklist(
  //> Source statement or expression.
  agent: Pick<Agent, "smokeTestPassedAt">
//> Source statement or expression.
): ReadinessChecklistItem {
  //> Conditional branch.
  if (!agent.smokeTestPassedAt) {
    //> Return a value.
    return {
      //> Source statement or expression.
      key: "smokeTest",
      //> Source statement or expression.
      label: "Smoke test",
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      detail: "Smoke test not marked as passed yet."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    key: "smokeTest",
    //> Source statement or expression.
    label: "Smoke test",
    //> Source statement or expression.
    ok: true,
    //> Source statement or expression.
    detail: `Passed at ${agent.smokeTestPassedAt.toLocaleString()}.`
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export function buildAgentReadinessChecklist(params: {
  //> Source statement or expression.
  agent: Pick<
    //> Source statement or expression.
    Agent,
    //> String literal line.
    "key" | "runtime" | "model" | "host" | "lastHeartbeatAt" | "smokeTestPassedAt"
  //> Delimiter or separator.
  >;
  //> Source statement or expression.
  config: AgentSetting | null;
  //> Source statement or expression.
  isRunning: boolean;
  //> Source statement or expression.
  nowMs?: number;
//> Source statement or expression.
}): AgentReadinessChecklist {
  //> Variable declaration.
  const nowMs = params.nowMs ?? Date.now();
  //> Variable declaration.
  const items: ReadinessChecklistItem[] = [
    //> Source statement or expression.
    runtimeConfigChecklist(params.agent, params.config),
    //> Source statement or expression.
    apiKeyChecklist(params.agent, params.config),
    //> Source statement or expression.
    heartbeatChecklist(params.agent, params.isRunning, nowMs),
    //> Source statement or expression.
    smokeTestChecklist(params.agent)
  //> Delimiter or separator.
  ];
  //> Variable declaration.
  const blockingReasons = items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.detail}`);
  //> Return a value.
  return {
    //> Source statement or expression.
    items,
    //> Source statement or expression.
    blockingReasons,
    //> Source statement or expression.
    checklistReady: blockingReasons.length === 0
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export function normalizeReadinessInput(v: string): AgentReadiness {
  //> Conditional branch.
  if (v === "READY" || v === "PAUSED" || v === "NOT_READY") return v;
  //> Throw error.
  throw new Error("Invalid readiness value.");
//> Brace or statement terminator.
}
