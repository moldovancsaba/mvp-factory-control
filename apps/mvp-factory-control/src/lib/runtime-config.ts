/**
 * Resolves **effective** runtime (LOCAL vs CLOUD) model/endpoint/API key env for workers and tasks.
 *
 * Builds a deterministic digest and `sourceChain` describing overlays: env defaults, agent settings,
 * project vars, and optional ALPHA context overlay. Only keys in `SAFE_RUNTIME_KEYS` participate;
 * mutability for settings UI is gated by `runtime-settings-mutability`.
 *
 * Consumed when enqueueing tasks and when surfacing config in the UI.
 */
//> Import bindings from a module.
import { createHash } from "node:crypto";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { readMVPFactoryControlSettings } from "@/lib/settings-store";
//> Import bindings from a module.
import { isMutableRuntimeSettingKey } from "@/lib/runtime-settings-mutability";

//> Type or interface definition.
type RuntimeMode = "LOCAL" | "CLOUD";

//> Type or interface definition.
type RuntimeConfigSource = {
  //> Source statement or expression.
  source: "ENV_DEFAULTS" | "AGENT_SETTINGS" | "PROJECT_SETTINGS_VARS" | "ALPHA_CONTEXT_OVERLAY";
  //> Source statement or expression.
  ref: string;
  //> Source statement or expression.
  appliedKeys: string[];
  //> Source statement or expression.
  ignoredKeys: string[];
//> Brace or statement terminator.
};

//> Export declaration.
export type RuntimeConfigEffective = {
  //> Source statement or expression.
  runtime: RuntimeMode;
  //> Source statement or expression.
  endpoint: string;
  //> Source statement or expression.
  model: string;
  //> Source statement or expression.
  apiKeyEnv: string | null;
  //> Source statement or expression.
  requestTimeoutMs: number;
//> Brace or statement terminator.
};

//> Export declaration.
export type RuntimeConfigResolution = {
  //> Source statement or expression.
  projectKey: string | null;
  //> Source statement or expression.
  projectName: string | null;
  //> Source statement or expression.
  activeContextWindowId: string | null;
  //> Source statement or expression.
  activeContextOwnerAgentKey: string | null;
  //> Source statement or expression.
  digest: string;
  //> Source statement or expression.
  sourceChain: RuntimeConfigSource[];
  //> Source statement or expression.
  effective: RuntimeConfigEffective;
  //> Source statement or expression.
  resolvedAt: string;
//> Brace or statement terminator.
};

//> Variable declaration.
const SAFE_RUNTIME_KEYS = new Set([
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_ENDPOINT",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_MODEL",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_API_KEY_ENV",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_TIMEOUT_MS",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_ENDPOINT",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_MODEL",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_ENDPOINT",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_MODEL",
  //> String literal line.
  "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_API_KEY_ENV"
//> Delimiter or separator.
]);

//> Function declaration.
function normalizeText(input: string | null | undefined) {
  //> Return a value.
  return String(input || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeLower(input: string | null | undefined) {
  //> Return a value.
  return normalizeText(input).toLowerCase();
//> Brace or statement terminator.
}

//> Function declaration.
function clampTimeout(value: unknown, fallback: number) {
  //> Variable declaration.
  const parsed = Number(value);
  //> Conditional branch.
  if (!Number.isFinite(parsed)) return fallback;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(parsed), 1_000), 300_000);
//> Brace or statement terminator.
}

//> Function declaration.
function asRecord(value: unknown): Record<string, unknown> | null {
  //> Conditional branch.
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  //> Return a value.
  return value as Record<string, unknown>;
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeForHash(value: unknown): unknown {
  //> Conditional branch.
  if (value === null || value === undefined) return null;
  //> Conditional branch.
  if (Array.isArray(value)) return value.map((entry) => normalizeForHash(entry));
  //> Conditional branch.
  if (typeof value === "object") {
    //> Variable declaration.
    const out: Record<string, unknown> = {};
    //> For-loop header.
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      //> Source statement or expression.
      out[key] = normalizeForHash((value as Record<string, unknown>)[key]);
    //> Brace or statement terminator.
    }
    //> Return a value.
    return out;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return value;
//> Brace or statement terminator.
}

//> Function declaration.
function digest(value: unknown) {
  //> Return a value.
  return createHash("sha256").update(JSON.stringify(normalizeForHash(value))).digest("hex");
//> Brace or statement terminator.
}

//> Function declaration.
function applyRuntimeOverrides(params: {
  //> Source statement or expression.
  runtime: RuntimeMode;
  //> Source statement or expression.
  effective: RuntimeConfigEffective;
  //> Source statement or expression.
  sourceValues: Record<string, string>;
  //> Source statement or expression.
  allowKey?: (key: string) => boolean;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const appliedKeys: string[] = [];
  //> Variable declaration.
  const ignoredKeys: string[] = [];
  //> Const with function or expression.
  const getValue = (key: string) => normalizeText(params.sourceValues[key]);
  //> Const with function or expression.
  const canApply = (key: string) => (params.allowKey ? params.allowKey(key) : true);
  //> Const with function or expression.
  const applyStringValue = (
    //> Source statement or expression.
    candidateKeys: string[],
    //> Source statement or expression.
    assign: (value: string) => void
  //> Source statement or expression.
  ) => {
    //> For-loop header.
    for (const key of candidateKeys) {
      //> Variable declaration.
      const value = getValue(key);
      //> Conditional branch.
      if (!value) continue;
      //> Conditional branch.
      if (!canApply(key)) {
        //> Source statement or expression.
        ignoredKeys.push(key);
        //> Return to caller.
        return;
      //> Brace or statement terminator.
      }
      //> Source statement or expression.
      assign(value);
      //> Source statement or expression.
      appliedKeys.push(key);
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  const runtimeEndpointKey =
    //> Source statement or expression.
    params.runtime === "LOCAL" ? "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_ENDPOINT" : "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_ENDPOINT";
  //> Variable declaration.
  const runtimeModelKey =
    //> Source statement or expression.
    params.runtime === "LOCAL" ? "MVP_FACTORY_CONTROL_RUNTIME_LOCAL_MODEL" : "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_MODEL";
  //> Variable declaration.
  const runtimeApiEnvKey =
    //> Source statement or expression.
    params.runtime === "CLOUD" ? "MVP_FACTORY_CONTROL_RUNTIME_CLOUD_API_KEY_ENV" : "";

  //> Source statement or expression.
  applyStringValue([runtimeEndpointKey, "MVP_FACTORY_CONTROL_RUNTIME_ENDPOINT"], (value) => {
    //> Source statement or expression.
    params.effective.endpoint = value;
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  applyStringValue([runtimeModelKey, "MVP_FACTORY_CONTROL_RUNTIME_MODEL"], (value) => {
    //> Source statement or expression.
    params.effective.model = value;
  //> Brace or statement terminator.
  });

  //> Conditional branch.
  if (params.runtime === "CLOUD") {
    //> Source statement or expression.
    applyStringValue([runtimeApiEnvKey, "MVP_FACTORY_CONTROL_RUNTIME_API_KEY_ENV"], (value) => {
      //> Source statement or expression.
      params.effective.apiKeyEnv = value;
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const timeoutRaw = getValue("MVP_FACTORY_CONTROL_RUNTIME_TIMEOUT_MS");
  //> Conditional branch.
  if (timeoutRaw) {
    //> Conditional branch.
    if (canApply("MVP_FACTORY_CONTROL_RUNTIME_TIMEOUT_MS")) {
      //> Source statement or expression.
      params.effective.requestTimeoutMs = clampTimeout(timeoutRaw, params.effective.requestTimeoutMs);
      //> Source statement or expression.
      appliedKeys.push("MVP_FACTORY_CONTROL_RUNTIME_TIMEOUT_MS");
    //> Source statement or expression.
    } else {
      //> Source statement or expression.
      ignoredKeys.push("MVP_FACTORY_CONTROL_RUNTIME_TIMEOUT_MS");
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> For-loop header.
  for (const key of Object.keys(params.sourceValues).sort()) {
    //> Conditional branch.
    if (!SAFE_RUNTIME_KEYS.has(key)) {
      //> Source statement or expression.
      ignoredKeys.push(key);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { appliedKeys, ignoredKeys };
//> Brace or statement terminator.
}

//> Function declaration.
function readContextRuntimeOverrides(payloadSnapshot: unknown): Record<string, string> {
  //> Variable declaration.
  const payload = asRecord(payloadSnapshot);
  //> Conditional branch.
  if (!payload) return {};
  //> Variable declaration.
  const direct = asRecord(payload.runtimeConfigOverrides);
  //> Variable declaration.
  const nested = asRecord(payload.runtimeConfig);
  //> Variable declaration.
  const source = direct || nested;
  //> Conditional branch.
  if (!source) return {};

  //> Variable declaration.
  const out: Record<string, string> = {};
  //> For-loop header.
  for (const [key, value] of Object.entries(source)) {
    //> Conditional branch.
    if (!SAFE_RUNTIME_KEYS.has(key)) continue;
    //> Conditional branch.
    if (typeof value === "string") {
      //> Variable declaration.
      const trimmed = value.trim();
      //> Conditional branch.
      if (trimmed) out[key] = trimmed;
    //> Source statement or expression.
    } else if (typeof value === "number" && Number.isFinite(value)) {
      //> Source statement or expression.
      out[key] = String(Math.trunc(value));
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Export declaration.
export async function resolveRuntimeConfigForTask(params: {
  //> Source statement or expression.
  projectName?: string | null;
  //> Source statement or expression.
  agentKey: string;
//> Source statement or expression.
}): Promise<RuntimeConfigResolution> {
  //> Variable declaration.
  const normalizedProjectName = normalizeText(params.projectName);
  //> Variable declaration.
  const projectKey = normalizedProjectName ? normalizeLower(normalizedProjectName) : null;

  //> Variable declaration.
  const agent = await prisma.agent.findFirst({
    //> Source statement or expression.
    where: { key: { equals: params.agentKey, mode: "insensitive" } },
    //> Source statement or expression.
    select: { key: true, runtime: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!agent || (agent.runtime !== "LOCAL" && agent.runtime !== "CLOUD")) {
    //> Throw error.
    throw new Error(`Runtime config resolution failed: agent @${params.agentKey} is not runnable.`);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const runtime = agent.runtime;
  //> Variable declaration.
  const sourceChain: RuntimeConfigSource[] = [];

  //> Variable declaration.
  const effective: RuntimeConfigEffective = {
    //> Source statement or expression.
    runtime,
    //> Source statement or expression.
    endpoint:
      //> Source statement or expression.
      runtime === "LOCAL"
        //> Source statement or expression.
        ? normalizeText(process.env.OLLAMA_BASE_URL) || "http://127.0.0.1:11434"
        //> Source statement or expression.
        : normalizeText(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1",
    //> Source statement or expression.
    model:
      //> Source statement or expression.
      runtime === "LOCAL"
        //> Source statement or expression.
        ? normalizeText(process.env.OLLAMA_MODEL) || "gemma4:latest"
        //> Source statement or expression.
        : normalizeText(process.env.OPENAI_MODEL) || "gpt-4o-mini",
    //> Source statement or expression.
    apiKeyEnv: runtime === "CLOUD" ? "OPENAI_API_KEY" : null,
    //> Source statement or expression.
    requestTimeoutMs: clampTimeout(process.env.MVP_FACTORY_CONTROL_WORKER_REQUEST_TIMEOUT_MS, 60_000)
  //> Brace or statement terminator.
  };

  //> Source statement or expression.
  sourceChain.push({
    //> Source statement or expression.
    source: "ENV_DEFAULTS",
    //> Source statement or expression.
    ref: "process.env",
    //> Source statement or expression.
    appliedKeys:
      //> Source statement or expression.
      runtime === "LOCAL"
        //> Source statement or expression.
        ? ["OLLAMA_BASE_URL", "OLLAMA_MODEL", "MVP_FACTORY_CONTROL_WORKER_REQUEST_TIMEOUT_MS"]
        //> Source statement or expression.
        : [
            //> String literal line.
            "OPENAI_BASE_URL",
            //> String literal line.
            "OPENAI_MODEL",
            //> String literal line.
            "OPENAI_API_KEY",
            //> String literal line.
            "MVP_FACTORY_CONTROL_WORKER_REQUEST_TIMEOUT_MS"
          //> Delimiter or separator.
          ],
    //> Source statement or expression.
    ignoredKeys: []
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const agentSetting = settings.agents.find(
    //> Source statement or expression.
    (row) =>
      //> Source statement or expression.
      normalizeLower(row.agentId) === normalizeLower(agent.key) ||
      //> Source statement or expression.
      normalizeLower(row.agentName) === normalizeLower(agent.key)
  //> Delimiter or separator.
  );
  //> Conditional branch.
  if (agentSetting) {
    //> Variable declaration.
    const appliedKeys: string[] = [];
    //> Conditional branch.
    if (normalizeText(agentSetting.agentUrl)) {
      //> Source statement or expression.
      effective.endpoint = normalizeText(agentSetting.agentUrl);
      //> Source statement or expression.
      appliedKeys.push("settings.agents.agentUrl");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (normalizeText(agentSetting.agentModel)) {
      //> Source statement or expression.
      effective.model = normalizeText(agentSetting.agentModel);
      //> Source statement or expression.
      appliedKeys.push("settings.agents.agentModel");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (runtime === "CLOUD" && normalizeText(agentSetting.agentApiKeyEnv)) {
      //> Source statement or expression.
      effective.apiKeyEnv = normalizeText(agentSetting.agentApiKeyEnv);
      //> Source statement or expression.
      appliedKeys.push("settings.agents.agentApiKeyEnv");
    //> Brace or statement terminator.
    }
    //> Source statement or expression.
    sourceChain.push({
      //> Source statement or expression.
      source: "AGENT_SETTINGS",
      //> Source statement or expression.
      ref: `settings.agents:${agentSetting.agentId || agentSetting.agentName}`,
      //> Source statement or expression.
      appliedKeys,
      //> Source statement or expression.
      ignoredKeys: []
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const projectSetting = normalizedProjectName
    //> Source statement or expression.
    ? settings.projects.find(
        //> Source statement or expression.
        (row) =>
          //> Source statement or expression.
          normalizeLower(row.projectName) === normalizeLower(normalizedProjectName) ||
          //> Source statement or expression.
          normalizeLower(row.projectId) === normalizeLower(normalizedProjectName)
      //> Delimiter or separator.
      )
    //> Source statement or expression.
    : null;

  //> Conditional branch.
  if (projectSetting) {
    //> Variable declaration.
    const vars: Record<string, string> = {};
    //> For-loop header.
    for (const row of projectSetting.vars) {
      //> Variable declaration.
      const key = normalizeText(row.key);
      //> Variable declaration.
      const value = normalizeText(row.value);
      //> Conditional branch.
      if (!key || !value) continue;
      //> Source statement or expression.
      vars[key] = value;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const projectOverrides = applyRuntimeOverrides({ runtime, effective, sourceValues: vars });
    //> Source statement or expression.
    sourceChain.push({
      //> Source statement or expression.
      source: "PROJECT_SETTINGS_VARS",
      //> Source statement or expression.
      ref: `settings.projects:${projectSetting.projectId}`,
      //> Source statement or expression.
      appliedKeys: projectOverrides.appliedKeys,
      //> Source statement or expression.
      ignoredKeys: projectOverrides.ignoredKeys
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  let activeContextWindowId: string | null = null;
  //> Variable declaration.
  let activeContextOwnerAgentKey: string | null = null;
  //> Conditional branch.
  if (projectKey) {
    //> Variable declaration.
    const lock = await prisma.projectAlphaLock.findUnique({
      //> Source statement or expression.
      where: { projectKey },
      //> Source statement or expression.
      include: {
        //> Source statement or expression.
        activeWindow: {
          //> Source statement or expression.
          select: {
            //> Source statement or expression.
            id: true,
            //> Source statement or expression.
            ownerAgentKey: true
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Source statement or expression.
    activeContextWindowId = lock?.activeWindow?.id ?? null;
    //> Source statement or expression.
    activeContextOwnerAgentKey = lock?.activeWindow?.ownerAgentKey ?? null;

    //> Conditional branch.
    if (activeContextWindowId) {
      //> Variable declaration.
      const latestContextSnapshot = await prisma.alphaContextPackageInvariant.findFirst({
        //> Source statement or expression.
        where: { windowId: activeContextWindowId },
        //> Source statement or expression.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        //> Source statement or expression.
        select: {
          //> Source statement or expression.
          id: true,
          //> Source statement or expression.
          payloadSnapshot: true
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      });

      //> Variable declaration.
      const contextValues = readContextRuntimeOverrides(
        //> Source statement or expression.
        latestContextSnapshot?.payloadSnapshot ?? null
      //> Delimiter or separator.
      );
      //> Variable declaration.
      const contextOverrides = applyRuntimeOverrides({
        //> Source statement or expression.
        runtime,
        //> Source statement or expression.
        effective,
        //> Source statement or expression.
        sourceValues: contextValues,
        //> Source statement or expression.
        allowKey: (key) => isMutableRuntimeSettingKey(key)
      //> Brace or statement terminator.
      });
      //> Source statement or expression.
      sourceChain.push({
        //> Source statement or expression.
        source: "ALPHA_CONTEXT_OVERLAY",
        //> Source statement or expression.
        ref: latestContextSnapshot
          //> Source statement or expression.
          ? `alpha-context-snapshot:${latestContextSnapshot.id}`
          //> Source statement or expression.
          : `alpha-context:${activeContextWindowId}`,
        //> Source statement or expression.
        appliedKeys: contextOverrides.appliedKeys,
        //> Source statement or expression.
        ignoredKeys: contextOverrides.ignoredKeys
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const digestValue = digest({
    //> Source statement or expression.
    projectKey,
    //> Source statement or expression.
    projectName: normalizedProjectName || null,
    //> Source statement or expression.
    activeContextWindowId,
    //> Source statement or expression.
    activeContextOwnerAgentKey,
    //> Source statement or expression.
    effective,
    //> Source statement or expression.
    sourceChain
  //> Brace or statement terminator.
  });

  //> Return a value.
  return {
    //> Source statement or expression.
    projectKey,
    //> Source statement or expression.
    projectName: normalizedProjectName || null,
    //> Source statement or expression.
    activeContextWindowId,
    //> Source statement or expression.
    activeContextOwnerAgentKey,
    //> Source statement or expression.
    digest: digestValue,
    //> Source statement or expression.
    sourceChain,
    //> Source statement or expression.
    effective,
    //> Source statement or expression.
    resolvedAt: new Date().toISOString()
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
