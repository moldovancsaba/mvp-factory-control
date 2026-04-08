/**
 * Classifies which runtime-related env keys may be edited from the settings UI vs immutable endpoints.
 *
 * Used to diff agent/project setting mutations and to guard `runtime-config` inputs. Immutable set includes
 * endpoint and API-key env names; mutable set includes models and timeout.
 */
import type { AgentSetting, ProjectVar } from "@/lib/settings-store";

export type RuntimeSettingMutabilityClass = "IMMUTABLE" | "MUTABLE";

const IMMUTABLE_RUNTIME_SETTING_KEYS = new Set([
  "MVP_FACTORY_CONTROL_RUNTIME_ENDPOINT",
  "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_ENDPOINT",
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_ENDPOINT",
  "MVP_FACTORY_CONTROL_RUNTIME_API_KEY_ENV",
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_API_KEY_ENV"
]);

const MUTABLE_RUNTIME_SETTING_KEYS = new Set([
  "MVP_FACTORY_CONTROL_RUNTIME_MODEL",
  "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_MODEL",
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_MODEL",
  "MVP_FACTORY_CONTROL_RUNTIME_TIMEOUT_MS"
]);

export function classifyRuntimeSettingKey(
  key: string
): RuntimeSettingMutabilityClass | null {
  const normalized = String(key || "").trim();
  if (!normalized) return null;
  if (IMMUTABLE_RUNTIME_SETTING_KEYS.has(normalized)) return "IMMUTABLE";
  if (MUTABLE_RUNTIME_SETTING_KEYS.has(normalized)) return "MUTABLE";
  return null;
}

export function isMutableRuntimeSettingKey(key: string) {
  return classifyRuntimeSettingKey(key) === "MUTABLE";
}

export function isImmutableRuntimeSettingKey(key: string) {
  return classifyRuntimeSettingKey(key) === "IMMUTABLE";
}

export type RuntimeMutabilityDiff = {
  immutableChangedKeys: string[];
  mutableChangedKeys: string[];
};

function projectVarFingerprint(row: ProjectVar): string {
  const value = String(row.value || "").trim();
  const formula = String(row.formula || "").trim();
  return formula ? `${value}\n::f::\n${formula}` : value;
}

function toProjectVarMap(vars: ProjectVar[]) {
  const out = new Map<string, string>();
  for (const row of vars) {
    const key = String(row.key || "").trim();
    if (!key) continue;
    out.set(key, projectVarFingerprint(row));
  }
  return out;
}

export function diffProjectRuntimeVarMutations(
  previousVars: ProjectVar[],
  nextVars: ProjectVar[]
): RuntimeMutabilityDiff {
  const previous = toProjectVarMap(previousVars);
  const next = toProjectVarMap(nextVars);
  const keys = Array.from(new Set([...previous.keys(), ...next.keys()]));

  const immutableChangedKeys: string[] = [];
  const mutableChangedKeys: string[] = [];

  for (const key of keys) {
    const policy = classifyRuntimeSettingKey(key);
    if (!policy) continue;
    const before = previous.get(key) || "";
    const after = next.get(key) || "";
    if (before === after) continue;
    if (policy === "IMMUTABLE") {
      // Allow first assignment, but deny subsequent edits/removals.
      if (before) immutableChangedKeys.push(key);
    }
    if (policy === "MUTABLE") mutableChangedKeys.push(key);
  }

  immutableChangedKeys.sort();
  mutableChangedKeys.sort();
  return { immutableChangedKeys, mutableChangedKeys };
}

export function diffAgentRuntimeSettingMutations(
  previous: AgentSetting | null,
  next: AgentSetting
): RuntimeMutabilityDiff {
  if (!previous) {
    return {
      immutableChangedKeys: [],
      mutableChangedKeys: []
    };
  }

  const immutableChangedKeys: string[] = [];
  const mutableChangedKeys: string[] = [];

  const beforeUrl = String(previous.agentUrl || "").trim();
  const afterUrl = String(next.agentUrl || "").trim();
  if (beforeUrl !== afterUrl && beforeUrl) {
    immutableChangedKeys.push("agentUrl");
  }
  const beforeApiEnv = String(previous.agentApiKeyEnv || "").trim();
  const afterApiEnv = String(next.agentApiKeyEnv || "").trim();
  if (beforeApiEnv !== afterApiEnv && beforeApiEnv) {
    immutableChangedKeys.push("agentApiKeyEnv");
  }
  if (String(previous.agentModel || "").trim() !== String(next.agentModel || "").trim()) {
    mutableChangedKeys.push("agentModel");
  }

  return {
    immutableChangedKeys,
    mutableChangedKeys
  };
}
