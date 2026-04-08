/**
 * Classifies which runtime-related env keys may be edited from the settings UI vs immutable endpoints.
 *
 * Used to diff agent/project setting mutations and to guard `runtime-config` inputs. Immutable set includes
 * endpoint and API-key env names; mutable set includes models and timeout.
 */
//> Import bindings from a module.
import type { AgentSetting, ProjectVar } from "@/lib/settings-store";

//> Export declaration.
export type RuntimeSettingMutabilityClass = "IMMUTABLE" | "MUTABLE";

//> Variable declaration.
const IMMUTABLE_RUNTIME_SETTING_KEYS = new Set([
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_ENDPOINT",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_ENDPOINT",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_ENDPOINT",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_API_KEY_ENV",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_API_KEY_ENV"
//> Delimiter or separator.
]);

//> Variable declaration.
const MUTABLE_RUNTIME_SETTING_KEYS = new Set([
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_MODEL",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_MODEL",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_MODEL",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_TIMEOUT_MS"
//> Delimiter or separator.
]);

//> Export declaration.
export function classifyRuntimeSettingKey(
  //> Source statement or expression.
  key: string
//> Source statement or expression.
): RuntimeSettingMutabilityClass | null {
  //> Variable declaration.
  const normalized = String(key || "").trim();
  //> Conditional branch.
  if (!normalized) return null;
  //> Conditional branch.
  if (IMMUTABLE_RUNTIME_SETTING_KEYS.has(normalized)) return "IMMUTABLE";
  //> Conditional branch.
  if (MUTABLE_RUNTIME_SETTING_KEYS.has(normalized)) return "MUTABLE";
  //> Return a value.
  return null;
//> Brace or statement terminator.
}

//> Export declaration.
export function isMutableRuntimeSettingKey(key: string) {
  //> Return a value.
  return classifyRuntimeSettingKey(key) === "MUTABLE";
//> Brace or statement terminator.
}

//> Export declaration.
export function isImmutableRuntimeSettingKey(key: string) {
  //> Return a value.
  return classifyRuntimeSettingKey(key) === "IMMUTABLE";
//> Brace or statement terminator.
}

//> Export declaration.
export type RuntimeMutabilityDiff = {
  //> Source statement or expression.
  immutableChangedKeys: string[];
  //> Source statement or expression.
  mutableChangedKeys: string[];
//> Brace or statement terminator.
};

//> Function declaration.
function toProjectVarMap(vars: ProjectVar[]) {
  //> Variable declaration.
  const out = new Map<string, string>();
  //> For-loop header.
  for (const row of vars) {
    //> Variable declaration.
    const key = String(row.key || "").trim();
    //> Conditional branch.
    if (!key) continue;
    //> Source statement or expression.
    out.set(key, String(row.value || "").trim());
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Export declaration.
export function diffProjectRuntimeVarMutations(
  //> Source statement or expression.
  previousVars: ProjectVar[],
  //> Source statement or expression.
  nextVars: ProjectVar[]
//> Source statement or expression.
): RuntimeMutabilityDiff {
  //> Variable declaration.
  const previous = toProjectVarMap(previousVars);
  //> Variable declaration.
  const next = toProjectVarMap(nextVars);
  //> Variable declaration.
  const keys = Array.from(new Set([...previous.keys(), ...next.keys()]));

  //> Variable declaration.
  const immutableChangedKeys: string[] = [];
  //> Variable declaration.
  const mutableChangedKeys: string[] = [];

  //> For-loop header.
  for (const key of keys) {
    //> Variable declaration.
    const policy = classifyRuntimeSettingKey(key);
    //> Conditional branch.
    if (!policy) continue;
    //> Variable declaration.
    const before = previous.get(key) || "";
    //> Variable declaration.
    const after = next.get(key) || "";
    //> Conditional branch.
    if (before === after) continue;
    //> Conditional branch.
    if (policy === "IMMUTABLE") {
      // Allow first assignment, but deny subsequent edits/removals.
      //> Conditional branch.
      if (before) immutableChangedKeys.push(key);
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (policy === "MUTABLE") mutableChangedKeys.push(key);
  //> Brace or statement terminator.
  }

  //> Source statement or expression.
  immutableChangedKeys.sort();
  //> Source statement or expression.
  mutableChangedKeys.sort();
  //> Return a value.
  return { immutableChangedKeys, mutableChangedKeys };
//> Brace or statement terminator.
}

//> Export declaration.
export function diffAgentRuntimeSettingMutations(
  //> Source statement or expression.
  previous: AgentSetting | null,
  //> Source statement or expression.
  next: AgentSetting
//> Source statement or expression.
): RuntimeMutabilityDiff {
  //> Conditional branch.
  if (!previous) {
    //> Return a value.
    return {
      //> Source statement or expression.
      immutableChangedKeys: [],
      //> Source statement or expression.
      mutableChangedKeys: []
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const immutableChangedKeys: string[] = [];
  //> Variable declaration.
  const mutableChangedKeys: string[] = [];

  //> Variable declaration.
  const beforeUrl = String(previous.agentUrl || "").trim();
  //> Variable declaration.
  const afterUrl = String(next.agentUrl || "").trim();
  //> Conditional branch.
  if (beforeUrl !== afterUrl && beforeUrl) {
    //> Source statement or expression.
    immutableChangedKeys.push("agentUrl");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const beforeApiEnv = String(previous.agentApiKeyEnv || "").trim();
  //> Variable declaration.
  const afterApiEnv = String(next.agentApiKeyEnv || "").trim();
  //> Conditional branch.
  if (beforeApiEnv !== afterApiEnv && beforeApiEnv) {
    //> Source statement or expression.
    immutableChangedKeys.push("agentApiKeyEnv");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (String(previous.agentModel || "").trim() !== String(next.agentModel || "").trim()) {
    //> Source statement or expression.
    mutableChangedKeys.push("agentModel");
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    immutableChangedKeys,
    //> Source statement or expression.
    mutableChangedKeys
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
