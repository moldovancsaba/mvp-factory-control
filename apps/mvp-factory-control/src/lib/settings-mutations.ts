/**
 * Validated **mutations** to `settings.json` entities (agents, projects, taste rubric) with audit trails.
 *
 * Applies runtime mutability diffs, Prisma lifecycle audit events, and UUID generation for new ids.
 * All exported functions are used exclusively from `src/app/settings/actions.ts` after RBAC checks.
 */
//> Import bindings from a module.
import { randomUUID } from "node:crypto";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import {
  //> Type or interface definition.
  type AgentSetting,
  //> Type or interface definition.
  type ProjectSetting,
  //> Type or interface definition.
  type ProjectVar,
  //> Type or interface definition.
  type TasteRubricVersion,
  //> Source statement or expression.
  readMVPFactoryControlSettings,
  //> Source statement or expression.
  writeMVPFactoryControlSettings
//> Source statement or expression.
} from "@/lib/settings-store";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  diffAgentRuntimeSettingMutations,
  //> Source statement or expression.
  diffProjectRuntimeVarMutations
//> Source statement or expression.
} from "@/lib/runtime-settings-mutability";

//> Function declaration.
function newId() {
  //> Return a value.
  return randomUUID().replace(/-/g, "");
//> Brace or statement terminator.
}

//> Export declaration.
export type SettingsMutationAuditContext = {
  //> Source statement or expression.
  actorRole?: string;
  //> Source statement or expression.
  actorUserId?: string | null;
  //> Source statement or expression.
  actorUserEmail?: string | null;
//> Brace or statement terminator.
};

//> Function declaration.
function resolveActorRole(context?: SettingsMutationAuditContext) {
  //> Return a value.
  return String(context?.actorRole || "HUMAN_OPERATOR").trim() || "HUMAN_OPERATOR";
//> Brace or statement terminator.
}

//> Async function declaration.
async function recordRuntimeMutabilityAudit(params: {
  //> Source statement or expression.
  action: string;
  //> Source statement or expression.
  entityId: string;
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  mutableChangedKeys?: string[];
  //> Source statement or expression.
  immutableChangedKeys?: string[];
  //> Source statement or expression.
  scope: "agent" | "project";
  //> Source statement or expression.
  auditContext?: SettingsMutationAuditContext;
//> Source statement or expression.
}) {
  //> Await async value.
  await prisma.lifecycleAuditEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      entityType: "SETTINGS_MUTABILITY",
      //> Source statement or expression.
      entityId: params.entityId,
      //> Source statement or expression.
      actorRole: resolveActorRole(params.auditContext),
      //> Source statement or expression.
      action: params.action,
      //> Source statement or expression.
      fromState: null,
      //> Source statement or expression.
      toState: null,
      //> Source statement or expression.
      allowed: params.allowed,
      //> Source statement or expression.
      reason: params.reason,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        scope: params.scope,
        //> Source statement or expression.
        mutableChangedKeys: params.mutableChangedKeys || [],
        //> Source statement or expression.
        immutableChangedKeys: params.immutableChangedKeys || [],
        //> Source statement or expression.
        actorUserId: params.auditContext?.actorUserId || null,
        //> Source statement or expression.
        actorUserEmail: params.auditContext?.actorUserEmail || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export function parseProjectVars(text: string): ProjectVar[] {
  //> Variable declaration.
  const out: ProjectVar[] = [];
  //> Variable declaration.
  const lines = text.split(/\r?\n/);

  //> For-loop header.
  for (const rawLine of lines) {
    //> Variable declaration.
    const line = rawLine.trim();
    //> Conditional branch.
    if (!line || line.startsWith("#")) continue;
    //> Variable declaration.
    const eq = line.indexOf("=");
    //> Conditional branch.
    if (eq <= 0) continue;
    //> Variable declaration.
    const key = line.slice(0, eq).trim();
    //> Variable declaration.
    const value = line.slice(eq + 1).trim();
    //> Conditional branch.
    if (!key) continue;
    //> Source statement or expression.
    out.push({ key, value });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Export declaration.
export function parseTasteRubricPrinciples(text: string): string[] {
  //> Variable declaration.
  const out: string[] = [];
  //> For-loop header.
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    //> Variable declaration.
    const line = rawLine.trim();
    //> Conditional branch.
    if (!line || line.startsWith("#")) continue;
    //> Source statement or expression.
    out.push(line);
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Export declaration.
export async function upsertAgentSetting(input: {
  //> Source statement or expression.
  agentId?: string;
  //> Source statement or expression.
  agentName: string;
  //> Source statement or expression.
  agentUrl?: string;
  //> Source statement or expression.
  agentModel?: string;
  //> Source statement or expression.
  agentApiKeyEnv?: string;
//> Source statement or expression.
}, options?: { auditContext?: SettingsMutationAuditContext }) {
  //> Variable declaration.
  const agentName = input.agentName.trim();
  //> Conditional branch.
  if (!agentName) throw new Error("Agent name is required.");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const next = settings.agents.slice();

  //> Variable declaration.
  const wantedId = input.agentId?.trim() || null;
  //> Variable declaration.
  const idx = next.findIndex((a) =>
    //> Source statement or expression.
    wantedId
      //> Source statement or expression.
      ? a.agentId === wantedId
      //> Source statement or expression.
      : a.agentName.toLowerCase() === agentName.toLowerCase()
  //> Delimiter or separator.
  );

  //> Variable declaration.
  const row: AgentSetting = {
    //> Source statement or expression.
    agentId: wantedId || (idx >= 0 ? next[idx].agentId : newId()),
    //> Source statement or expression.
    agentName,
    //> Source statement or expression.
    agentUrl: input.agentUrl?.trim() || "",
    //> Source statement or expression.
    agentModel: input.agentModel?.trim() || "",
    //> Source statement or expression.
    agentApiKeyEnv: input.agentApiKeyEnv?.trim() || ""
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  const previous = idx >= 0 ? next[idx] : null;
  //> Variable declaration.
  const agentDiff = diffAgentRuntimeSettingMutations(previous, row);
  //> Conditional branch.
  if (agentDiff.immutableChangedKeys.length > 0) {
    //> Variable declaration.
    const reason =
      //> String literal line.
      `Runtime settings mutation denied for agent ${agentName}: ` +
      //> String literal line.
      `immutable keys changed (${agentDiff.immutableChangedKeys.join(", ")}).`;
    //> Await async value.
    await recordRuntimeMutabilityAudit({
      //> Source statement or expression.
      action: "RUNTIME_SETTINGS_MUTATION",
      //> Source statement or expression.
      entityId: `agent:${row.agentId}`,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      immutableChangedKeys: agentDiff.immutableChangedKeys,
      //> Source statement or expression.
      mutableChangedKeys: agentDiff.mutableChangedKeys,
      //> Source statement or expression.
      scope: "agent",
      //> Source statement or expression.
      auditContext: options?.auditContext
    //> Brace or statement terminator.
    });
    //> Throw error.
    throw new Error(reason);
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (idx >= 0) next[idx] = row;
  //> Else branch.
  else next.push(row);

  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    agents: next.sort((a, b) => a.agentName.localeCompare(b.agentName))
  //> Brace or statement terminator.
  });

  //> Conditional branch.
  if (agentDiff.mutableChangedKeys.length > 0) {
    //> Await async value.
    await recordRuntimeMutabilityAudit({
      //> Source statement or expression.
      action: "RUNTIME_SETTINGS_MUTATION",
      //> Source statement or expression.
      entityId: `agent:${row.agentId}`,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: `Runtime mutable keys updated for agent ${agentName}.`,
      //> Source statement or expression.
      mutableChangedKeys: agentDiff.mutableChangedKeys,
      //> Source statement or expression.
      scope: "agent",
      //> Source statement or expression.
      auditContext: options?.auditContext
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return row;
//> Brace or statement terminator.
}

//> Export declaration.
export async function removeAgentSetting(input: {
  //> Source statement or expression.
  agentId?: string;
  //> Source statement or expression.
  agentName?: string;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const agentId = input.agentId?.trim() || null;
  //> Variable declaration.
  const agentName = input.agentName?.trim().toLowerCase() || null;
  //> Conditional branch.
  if (!agentId && !agentName) throw new Error("Missing agent selector.");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    agents: settings.agents.filter((a) => {
      //> Conditional branch.
      if (agentId) return a.agentId !== agentId;
      //> Return a value.
      return a.agentName.toLowerCase() !== agentName;
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function mergeAgentSettings(input: {
  //> Source statement or expression.
  canonicalName: string;
  //> Source statement or expression.
  aliases: string[];
//> Source statement or expression.
}) {
  //> Variable declaration.
  const canonicalName = input.canonicalName.trim();
  //> Conditional branch.
  if (!canonicalName) throw new Error("Canonical agent name is required.");

  //> Variable declaration.
  const aliasSet = new Set(
    //> Source statement or expression.
    [canonicalName, ...input.aliases]
      //> Source statement or expression.
      .map((name) => name.trim().toLowerCase())
      //> Source statement or expression.
      .filter(Boolean)
  //> Delimiter or separator.
  );
  //> Conditional branch.
  if (!aliasSet.size) throw new Error("No aliases provided for merge.");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const matching = settings.agents.filter((row) =>
    //> Source statement or expression.
    aliasSet.has(row.agentName.toLowerCase())
  //> Delimiter or separator.
  );
  //> Conditional branch.
  if (matching.length === 0) {
    //> Return a value.
    return { before: settings.agents.length, after: settings.agents.length, merged: 0 };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const preferred =
    //> Source statement or expression.
    matching.find((row) => row.agentName.toLowerCase() === canonicalName.toLowerCase()) ||
    //> Source statement or expression.
    matching[0];
  //> Variable declaration.
  const ordered = [preferred, ...matching.filter((row) => row !== preferred)];

  //> Variable declaration.
  const merged: AgentSetting = {
    //> Source statement or expression.
    agentId: preferred.agentId.trim() || newId(),
    //> Source statement or expression.
    agentName: canonicalName,
    //> Source statement or expression.
    agentUrl: "",
    //> Source statement or expression.
    agentModel: "",
    //> Source statement or expression.
    agentApiKeyEnv: ""
  //> Brace or statement terminator.
  };

  //> For-loop header.
  for (const row of ordered) {
    //> Variable declaration.
    const agentUrl = row.agentUrl.trim();
    //> Variable declaration.
    const agentModel = row.agentModel.trim();
    //> Variable declaration.
    const agentApiKeyEnv = row.agentApiKeyEnv.trim();
    //> Conditional branch.
    if (!merged.agentUrl && agentUrl) merged.agentUrl = agentUrl;
    //> Conditional branch.
    if (!merged.agentModel && agentModel) merged.agentModel = agentModel;
    //> Conditional branch.
    if (!merged.agentApiKeyEnv && agentApiKeyEnv) merged.agentApiKeyEnv = agentApiKeyEnv;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const nextAgents = settings.agents
    //> Source statement or expression.
    .filter((row) => !aliasSet.has(row.agentName.toLowerCase()))
    //> Source statement or expression.
    .concat(merged)
    //> Source statement or expression.
    .sort((a, b) => a.agentName.localeCompare(b.agentName));

  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    agents: nextAgents
  //> Brace or statement terminator.
  });

  //> Return a value.
  return {
    //> Source statement or expression.
    before: settings.agents.length,
    //> Source statement or expression.
    after: nextAgents.length,
    //> Source statement or expression.
    merged: Math.max(matching.length - 1, 0)
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export async function upsertProjectSetting(input: {
  //> Source statement or expression.
  projectId?: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  projectUrl?: string;
  //> Source statement or expression.
  projectGithub?: string;
  //> Source statement or expression.
  vars?: ProjectVar[];
//> Source statement or expression.
}, options?: { auditContext?: SettingsMutationAuditContext }) {
  //> Variable declaration.
  const projectName = input.projectName.trim();
  //> Conditional branch.
  if (!projectName) throw new Error("Project name is required.");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const next = settings.projects.slice();

  //> Variable declaration.
  const wantedId = input.projectId?.trim() || null;
  //> Variable declaration.
  const idx = next.findIndex((p) =>
    //> Source statement or expression.
    wantedId
      //> Source statement or expression.
      ? p.projectId === wantedId
      //> Source statement or expression.
      : p.projectName.toLowerCase() === projectName.toLowerCase()
  //> Delimiter or separator.
  );

  //> Variable declaration.
  const row: ProjectSetting = {
    //> Source statement or expression.
    projectId: wantedId || (idx >= 0 ? next[idx].projectId : newId()),
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    projectUrl: input.projectUrl?.trim() || "",
    //> Source statement or expression.
    projectGithub: input.projectGithub?.trim() || "",
    //> Source statement or expression.
    vars: input.vars || []
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  const previous = idx >= 0 ? next[idx] : null;
  //> Variable declaration.
  const projectDiff = diffProjectRuntimeVarMutations(previous?.vars || [], row.vars);
  //> Conditional branch.
  if (projectDiff.immutableChangedKeys.length > 0) {
    //> Variable declaration.
    const reason =
      //> String literal line.
      `Runtime settings mutation denied for project ${projectName}: ` +
      //> String literal line.
      `immutable keys changed (${projectDiff.immutableChangedKeys.join(", ")}).`;
    //> Await async value.
    await recordRuntimeMutabilityAudit({
      //> Source statement or expression.
      action: "RUNTIME_SETTINGS_MUTATION",
      //> Source statement or expression.
      entityId: `project:${row.projectId}`,
      //> Source statement or expression.
      allowed: false,
      //> Source statement or expression.
      reason,
      //> Source statement or expression.
      immutableChangedKeys: projectDiff.immutableChangedKeys,
      //> Source statement or expression.
      mutableChangedKeys: projectDiff.mutableChangedKeys,
      //> Source statement or expression.
      scope: "project",
      //> Source statement or expression.
      auditContext: options?.auditContext
    //> Brace or statement terminator.
    });
    //> Throw error.
    throw new Error(reason);
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (idx >= 0) next[idx] = row;
  //> Else branch.
  else next.push(row);

  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    projects: next.sort((a, b) => a.projectName.localeCompare(b.projectName))
  //> Brace or statement terminator.
  });

  //> Conditional branch.
  if (projectDiff.mutableChangedKeys.length > 0) {
    //> Await async value.
    await recordRuntimeMutabilityAudit({
      //> Source statement or expression.
      action: "RUNTIME_SETTINGS_MUTATION",
      //> Source statement or expression.
      entityId: `project:${row.projectId}`,
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: `Runtime mutable keys updated for project ${projectName}.`,
      //> Source statement or expression.
      mutableChangedKeys: projectDiff.mutableChangedKeys,
      //> Source statement or expression.
      scope: "project",
      //> Source statement or expression.
      auditContext: options?.auditContext
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return row;
//> Brace or statement terminator.
}

//> Export declaration.
export async function removeProjectSetting(input: {
  //> Source statement or expression.
  projectId?: string;
  //> Source statement or expression.
  projectName?: string;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const projectId = input.projectId?.trim() || null;
  //> Variable declaration.
  const projectName = input.projectName?.trim().toLowerCase() || null;
  //> Conditional branch.
  if (!projectId && !projectName) throw new Error("Missing project selector.");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    projects: settings.projects.filter((p) => {
      //> Conditional branch.
      if (projectId) return p.projectId !== projectId;
      //> Return a value.
      return p.projectName.toLowerCase() !== projectName;
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function cleanProjectSettings(input?: { boardProjectNames?: string[] }) {
  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const boardByLower = new Map<string, string>();
  //> For-loop header.
  for (const name of input?.boardProjectNames || []) {
    //> Variable declaration.
    const trimmed = name.trim();
    //> Conditional branch.
    if (!trimmed) continue;
    //> Source statement or expression.
    boardByLower.set(trimmed.toLowerCase(), trimmed);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const merged = new Map<string, ProjectSetting>();
  //> Variable declaration.
  let removed = 0;
  //> Variable declaration.
  let renamed = 0;

  //> For-loop header.
  for (const project of settings.projects) {
    //> Variable declaration.
    const rawName = project.projectName.trim();
    //> Conditional branch.
    if (!rawName) {
      //> Source statement or expression.
      removed += 1;
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const canonicalName = boardByLower.get(rawName.toLowerCase()) || rawName;
    //> Conditional branch.
    if (canonicalName !== project.projectName) renamed += 1;
    //> Variable declaration.
    const key = canonicalName.toLowerCase();
    //> Variable declaration.
    const normalized: ProjectSetting = {
      //> Source statement or expression.
      projectId: project.projectId.trim() || newId(),
      //> Source statement or expression.
      projectName: canonicalName,
      //> Source statement or expression.
      projectUrl: project.projectUrl.trim(),
      //> Source statement or expression.
      projectGithub: project.projectGithub.trim(),
      //> Source statement or expression.
      vars: project.vars
    //> Brace or statement terminator.
    };

    //> Variable declaration.
    const existing = merged.get(key);
    //> Conditional branch.
    if (!existing) {
      //> Source statement or expression.
      merged.set(key, normalized);
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }

    //> Source statement or expression.
    removed += 1;
    //> Source statement or expression.
    merged.set(key, {
      //> Source statement or expression.
      ...existing,
      //> Source statement or expression.
      projectUrl: existing.projectUrl || normalized.projectUrl,
      //> Source statement or expression.
      projectGithub: existing.projectGithub || normalized.projectGithub,
      //> Source statement or expression.
      vars: existing.vars.length ? existing.vars : normalized.vars
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const nextProjects = Array.from(merged.values()).sort((a, b) =>
    //> Source statement or expression.
    a.projectName.localeCompare(b.projectName)
  //> Delimiter or separator.
  );

  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    projects: nextProjects
  //> Brace or statement terminator.
  });

  //> Return a value.
  return {
    //> Source statement or expression.
    before: settings.projects.length,
    //> Source statement or expression.
    after: nextProjects.length,
    //> Source statement or expression.
    removed,
    //> Source statement or expression.
    renamed
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export async function upsertTasteRubricVersion(input: {
  //> Source statement or expression.
  version: string;
  //> Source statement or expression.
  ownerEmail: string;
  //> Source statement or expression.
  summary?: string;
  //> Source statement or expression.
  principles?: string[];
  //> Source statement or expression.
  changeReason?: string;
  //> Source statement or expression.
  updatedBy?: string;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const version = input.version.trim();
  //> Variable declaration.
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  //> Conditional branch.
  if (!version) throw new Error("Taste rubric version is required.");
  //> Conditional branch.
  if (!ownerEmail) throw new Error("Taste rubric owner email is required.");

  //> Variable declaration.
  const summary = input.summary?.trim() || "";
  //> Const with function or expression.
  const principles = (input.principles || []).map((line) => line.trim()).filter(Boolean);
  //> Variable declaration.
  const changeReason = input.changeReason?.trim() || "";
  //> Variable declaration.
  const updatedBy = input.updatedBy?.trim() || ownerEmail;

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const existingVersions = settings.tasteRubric?.versions || [];
  //> Variable declaration.
  const idx = existingVersions.findIndex(
    //> Source statement or expression.
    (row) => row.version.toLowerCase() === version.toLowerCase()
  //> Delimiter or separator.
  );

  //> Variable declaration.
  const nextRow: TasteRubricVersion = {
    //> Source statement or expression.
    version,
    //> Source statement or expression.
    ownerEmail,
    //> Source statement or expression.
    summary,
    //> Source statement or expression.
    principles,
    //> Source statement or expression.
    changeReason,
    //> Source statement or expression.
    source: "HUMAN",
    //> Source statement or expression.
    updatedBy,
    //> Source statement or expression.
    updatedAt: new Date().toISOString()
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  const nextVersions =
    //> Source statement or expression.
    idx >= 0
      //> Source statement or expression.
      ? existingVersions.map((row, rowIndex) => (rowIndex === idx ? nextRow : row))
      //> Source statement or expression.
      : existingVersions.concat(nextRow);

  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    tasteRubric: {
      //> Source statement or expression.
      activeVersion: version,
      //> Source statement or expression.
      versions: nextVersions
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Return a value.
  return nextRow;
//> Brace or statement terminator.
}
