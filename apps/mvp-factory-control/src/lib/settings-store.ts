/**
 * JSON settings persistence for operators: agents, projects, local folder root, taste rubric.
 *
 * File path: `<cwd>/.mvp-factory-control/settings.json` (created on first write). Default project
 * root when unset: `/Users/moldovancsaba/Projects` or `MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT`.
 * Used by settings UI server actions, runtime resolution, and task enqueue for rubric version.
 */
import fs from "node:fs/promises";
import path from "node:path";

export type AgentSetting = {
  agentId: string;
  agentName: string;
  agentUrl: string;
  agentModel: string;
  agentApiKeyEnv: string;
};

export type ProjectVar = {
  key: string;
  value: string;
  /** When set, this template (with `${OTHER_KEY}` refs) defines the effective value instead of `value`. */
  formula?: string;
  /** UI grouping; default "General" in the editor. */
  group?: string;
  /** Short documentation (tooltip / modal) for operators. */
  doc?: string;
};

export type ProjectVarUsageEntry = {
  count: number;
  lastUsedAt: string;
};

export type ProjectSetting = {
  projectId: string;
  projectName: string;
  projectUrl: string;
  projectGithub: string;
  vars: ProjectVar[];
  /** Incremented when runtime resolution applies vars (see `recordProjectVarUsage`). */
  varUsage?: Record<string, ProjectVarUsageEntry>;
};

export type TasteRubricVersion = {
  version: string;
  ownerEmail: string;
  summary: string;
  principles: string[];
  changeReason: string;
  source: "HUMAN";
  updatedBy: string;
  updatedAt: string;
};

export type TasteRubricConfig = {
  activeVersion: string;
  versions: TasteRubricVersion[];
};

export type MVPFactoryControlSettings = {
  localProjectFolder: string;
  agents: AgentSetting[];
  projects: ProjectSetting[];
  tasteRubric: TasteRubricConfig | null;
  updatedAt: string;
};

const DEFAULT_PROJECT_ROOT = "/Users/moldovancsaba/Projects";

function settingsPath() {
  return path.join(process.cwd(), ".mvp-factory-control", "settings.json");
}

function defaultSettings(): MVPFactoryControlSettings {
  return {
    localProjectFolder: process.env.MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT || DEFAULT_PROJECT_ROOT,
    agents: [],
    projects: [],
    tasteRubric: null,
    updatedAt: new Date(0).toISOString()
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function normalizeProjectVarUsage(input: unknown): Record<string, ProjectVarUsageEntry> | undefined {
  const record = asRecord(input);
  if (!record) return undefined;
  const out: Record<string, ProjectVarUsageEntry> = {};
  for (const [key, raw] of Object.entries(record)) {
    const r = asRecord(raw);
    if (!r) continue;
    const count = Number(r.count);
    const lastUsedAt = asString(r.lastUsedAt).trim();
    if (!Number.isFinite(count) || count < 0 || !lastUsedAt) continue;
    out[key] = { count: Math.trunc(count), lastUsedAt };
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeProjectVars(input: unknown): ProjectVar[] {
  if (!Array.isArray(input)) return [];
  const out: ProjectVar[] = [];
  for (const raw of input) {
    const record = asRecord(raw);
    if (!record) continue;
    const key = asString(record.key).trim();
    if (!key) continue;
    const value = asString(record.value).trim();
    const formula = asString(record.formula).trim();
    const group = asString(record.group).trim();
    const doc = asString(record.doc).trim();
    const row: ProjectVar = { key, value };
    if (formula) row.formula = formula;
    if (group) row.group = group;
    if (doc) row.doc = doc;
    out.push(row);
  }
  return out;
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => asString(value).trim())
    .filter(Boolean);
}

function normalizeTasteRubricVersion(input: unknown): TasteRubricVersion | null {
  const row = asRecord(input);
  if (!row) return null;
  const version = asString(row.version).trim();
  const ownerEmail = asString(row.ownerEmail).trim().toLowerCase();
  if (!version || !ownerEmail) return null;

  return {
    version,
    ownerEmail,
    summary: asString(row.summary).trim(),
    principles: normalizeStringList(row.principles),
    changeReason: asString(row.changeReason).trim(),
    source: "HUMAN",
    updatedBy: asString(row.updatedBy).trim(),
    updatedAt: asString(row.updatedAt).trim() || new Date(0).toISOString()
  };
}

function normalizeTasteRubric(input: unknown): TasteRubricConfig | null {
  const record = asRecord(input);
  if (!record) return null;
  const versions = Array.isArray(record.versions)
    ? record.versions
        .map(normalizeTasteRubricVersion)
        .filter((value): value is TasteRubricVersion => Boolean(value))
    : [];
  if (!versions.length) return null;

  const activeVersionRaw = asString(record.activeVersion).trim();
  const activeVersion =
    versions.find((row) => row.version === activeVersionRaw)?.version || versions[0].version;

  return {
    activeVersion,
    versions
  };
}

function normalizeSettings(raw: unknown): MVPFactoryControlSettings {
  const base = defaultSettings();
  const record = asRecord(raw);
  if (!record) return base;

  const localProjectFolder = asString(record.localProjectFolder).trim() || base.localProjectFolder;

  const agents = Array.isArray(record.agents)
    ? record.agents
        .map((v) => {
          const row = asRecord(v);
          if (!row) return null;
          const agentId = asString(row.agentId).trim();
          const agentName = asString(row.agentName).trim();
          if (!agentId || !agentName) return null;
          return {
            agentId,
            agentName,
            agentUrl: asString(row.agentUrl).trim(),
            agentModel: asString(row.agentModel).trim(),
            agentApiKeyEnv: asString(row.agentApiKeyEnv).trim()
          } as AgentSetting;
        })
        .filter((v): v is AgentSetting => Boolean(v))
    : [];

  const projects = Array.isArray(record.projects)
    ? record.projects
        .map((v) => {
          const row = asRecord(v);
          if (!row) return null;
          const projectId = asString(row.projectId).trim();
          const projectName = asString(row.projectName).trim();
          if (!projectId || !projectName) return null;
          const normalized: ProjectSetting = {
            projectId,
            projectName,
            projectUrl: asString(row.projectUrl).trim(),
            projectGithub: asString(row.projectGithub).trim(),
            vars: normalizeProjectVars(row.vars)
          };
          const vu = normalizeProjectVarUsage(row.varUsage);
          if (vu) normalized.varUsage = vu;
          return normalized;
        })
        .filter((v): v is ProjectSetting => Boolean(v))
    : [];

  const tasteRubric = normalizeTasteRubric(record.tasteRubric);

  return {
    localProjectFolder,
    agents,
    projects,
    tasteRubric,
    updatedAt: asString(record.updatedAt) || base.updatedAt
  };
}

async function ensureSettingsDir() {
  const file = settingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  return file;
}

export async function readMVPFactoryControlSettings(): Promise<MVPFactoryControlSettings> {
  const file = await ensureSettingsDir();
  try {
    const raw = await fs.readFile(file, "utf8");
    return normalizeSettings(JSON.parse(raw));
  } catch {
    const defaults = defaultSettings();
    await writeMVPFactoryControlSettings(defaults);
    return defaults;
  }
}

export async function writeMVPFactoryControlSettings(input: MVPFactoryControlSettings) {
  const file = await ensureSettingsDir();
  const next = {
    ...input,
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function getActiveTasteRubricVersion(settings: MVPFactoryControlSettings): TasteRubricVersion | null {
  const rubric = settings.tasteRubric;
  if (!rubric || !rubric.versions.length) return null;
  return (
    rubric.versions.find((row) => row.version === rubric.activeVersion) || rubric.versions[0]
  );
}
