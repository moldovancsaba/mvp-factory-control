/**
 * JSON settings persistence for operators: agents, projects, local folder root, taste rubric.
 *
 * File path: `<cwd>/.mvp-factory-control/settings.json` (created on first write). Default project
 * root when unset: `/Users/moldovancsaba/Projects` or `MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT`.
 * Used by settings UI server actions, runtime resolution, and task enqueue for rubric version.
 */
//> Import bindings from a module.
import fs from "node:fs/promises";
//> Import bindings from a module.
import path from "node:path";

//> Export declaration.
export type AgentSetting = {
  //> Source statement or expression.
  agentId: string;
  //> Source statement or expression.
  agentName: string;
  //> Source statement or expression.
  agentUrl: string;
  //> Source statement or expression.
  agentModel: string;
  //> Source statement or expression.
  agentApiKeyEnv: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type ProjectVar = {
  //> Source statement or expression.
  key: string;
  //> Source statement or expression.
  value: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type ProjectSetting = {
  //> Source statement or expression.
  projectId: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  projectUrl: string;
  //> Source statement or expression.
  projectGithub: string;
  //> Source statement or expression.
  vars: ProjectVar[];
//> Brace or statement terminator.
};

//> Export declaration.
export type TasteRubricVersion = {
  //> Source statement or expression.
  version: string;
  //> Source statement or expression.
  ownerEmail: string;
  //> Source statement or expression.
  summary: string;
  //> Source statement or expression.
  principles: string[];
  //> Source statement or expression.
  changeReason: string;
  //> Source statement or expression.
  source: "HUMAN";
  //> Source statement or expression.
  updatedBy: string;
  //> Source statement or expression.
  updatedAt: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type TasteRubricConfig = {
  //> Source statement or expression.
  activeVersion: string;
  //> Source statement or expression.
  versions: TasteRubricVersion[];
//> Brace or statement terminator.
};

//> Export declaration.
export type MVPFactoryControlSettings = {
  //> Source statement or expression.
  localProjectFolder: string;
  //> Source statement or expression.
  agents: AgentSetting[];
  //> Source statement or expression.
  projects: ProjectSetting[];
  //> Source statement or expression.
  tasteRubric: TasteRubricConfig | null;
  //> Source statement or expression.
  updatedAt: string;
//> Brace or statement terminator.
};

//> Variable declaration.
const DEFAULT_PROJECT_ROOT = "/Users/moldovancsaba/Projects";

//> Function declaration.
function settingsPath() {
  //> Return a value.
  return path.join(process.cwd(), ".mvp-factory-control", "settings.json");
//> Brace or statement terminator.
}

//> Function declaration.
function defaultSettings(): MVPFactoryControlSettings {
  //> Return a value.
  return {
    //> Source statement or expression.
    localProjectFolder: process.env.MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT || DEFAULT_PROJECT_ROOT,
    //> Source statement or expression.
    agents: [],
    //> Source statement or expression.
    projects: [],
    //> Source statement or expression.
    tasteRubric: null,
    //> Source statement or expression.
    updatedAt: new Date(0).toISOString()
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function asRecord(v: unknown): Record<string, unknown> | null {
  //> Conditional branch.
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  //> Return a value.
  return v as Record<string, unknown>;
//> Brace or statement terminator.
}

//> Function declaration.
function asString(v: unknown) {
  //> Return a value.
  return typeof v === "string" ? v : "";
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeProjectVars(input: unknown): ProjectVar[] {
  //> Conditional branch.
  if (!Array.isArray(input)) return [];
  //> Variable declaration.
  const out: ProjectVar[] = [];
  //> For-loop header.
  for (const raw of input) {
    //> Variable declaration.
    const record = asRecord(raw);
    //> Conditional branch.
    if (!record) continue;
    //> Variable declaration.
    const key = asString(record.key).trim();
    //> Conditional branch.
    if (!key) continue;
    //> Variable declaration.
    const value = asString(record.value).trim();
    //> Source statement or expression.
    out.push({ key, value });
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeStringList(input: unknown): string[] {
  //> Conditional branch.
  if (!Array.isArray(input)) return [];
  //> Return a value.
  return input
    //> Source statement or expression.
    .map((value) => asString(value).trim())
    //> Source statement or expression.
    .filter(Boolean);
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeTasteRubricVersion(input: unknown): TasteRubricVersion | null {
  //> Variable declaration.
  const row = asRecord(input);
  //> Conditional branch.
  if (!row) return null;
  //> Variable declaration.
  const version = asString(row.version).trim();
  //> Variable declaration.
  const ownerEmail = asString(row.ownerEmail).trim().toLowerCase();
  //> Conditional branch.
  if (!version || !ownerEmail) return null;

  //> Return a value.
  return {
    //> Source statement or expression.
    version,
    //> Source statement or expression.
    ownerEmail,
    //> Source statement or expression.
    summary: asString(row.summary).trim(),
    //> Source statement or expression.
    principles: normalizeStringList(row.principles),
    //> Source statement or expression.
    changeReason: asString(row.changeReason).trim(),
    //> Source statement or expression.
    source: "HUMAN",
    //> Source statement or expression.
    updatedBy: asString(row.updatedBy).trim(),
    //> Source statement or expression.
    updatedAt: asString(row.updatedAt).trim() || new Date(0).toISOString()
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeTasteRubric(input: unknown): TasteRubricConfig | null {
  //> Variable declaration.
  const record = asRecord(input);
  //> Conditional branch.
  if (!record) return null;
  //> Variable declaration.
  const versions = Array.isArray(record.versions)
    //> Source statement or expression.
    ? record.versions
        //> Source statement or expression.
        .map(normalizeTasteRubricVersion)
        //> Source statement or expression.
        .filter((value): value is TasteRubricVersion => Boolean(value))
    //> Source statement or expression.
    : [];
  //> Conditional branch.
  if (!versions.length) return null;

  //> Variable declaration.
  const activeVersionRaw = asString(record.activeVersion).trim();
  //> Variable declaration.
  const activeVersion =
    //> Source statement or expression.
    versions.find((row) => row.version === activeVersionRaw)?.version || versions[0].version;

  //> Return a value.
  return {
    //> Source statement or expression.
    activeVersion,
    //> Source statement or expression.
    versions
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeSettings(raw: unknown): MVPFactoryControlSettings {
  //> Variable declaration.
  const base = defaultSettings();
  //> Variable declaration.
  const record = asRecord(raw);
  //> Conditional branch.
  if (!record) return base;

  //> Variable declaration.
  const localProjectFolder = asString(record.localProjectFolder).trim() || base.localProjectFolder;

  //> Variable declaration.
  const agents = Array.isArray(record.agents)
    //> Source statement or expression.
    ? record.agents
        //> Source statement or expression.
        .map((v) => {
          //> Variable declaration.
          const row = asRecord(v);
          //> Conditional branch.
          if (!row) return null;
          //> Variable declaration.
          const agentId = asString(row.agentId).trim();
          //> Variable declaration.
          const agentName = asString(row.agentName).trim();
          //> Conditional branch.
          if (!agentId || !agentName) return null;
          //> Return a value.
          return {
            //> Source statement or expression.
            agentId,
            //> Source statement or expression.
            agentName,
            //> Source statement or expression.
            agentUrl: asString(row.agentUrl).trim(),
            //> Source statement or expression.
            agentModel: asString(row.agentModel).trim(),
            //> Source statement or expression.
            agentApiKeyEnv: asString(row.agentApiKeyEnv).trim()
          //> Source statement or expression.
          } as AgentSetting;
        //> Delimiter or separator.
        })
        //> Source statement or expression.
        .filter((v): v is AgentSetting => Boolean(v))
    //> Source statement or expression.
    : [];

  //> Variable declaration.
  const projects = Array.isArray(record.projects)
    //> Source statement or expression.
    ? record.projects
        //> Source statement or expression.
        .map((v) => {
          //> Variable declaration.
          const row = asRecord(v);
          //> Conditional branch.
          if (!row) return null;
          //> Variable declaration.
          const projectId = asString(row.projectId).trim();
          //> Variable declaration.
          const projectName = asString(row.projectName).trim();
          //> Conditional branch.
          if (!projectId || !projectName) return null;
          //> Return a value.
          return {
            //> Source statement or expression.
            projectId,
            //> Source statement or expression.
            projectName,
            //> Source statement or expression.
            projectUrl: asString(row.projectUrl).trim(),
            //> Source statement or expression.
            projectGithub: asString(row.projectGithub).trim(),
            //> Source statement or expression.
            vars: normalizeProjectVars(row.vars)
          //> Source statement or expression.
          } as ProjectSetting;
        //> Delimiter or separator.
        })
        //> Source statement or expression.
        .filter((v): v is ProjectSetting => Boolean(v))
    //> Source statement or expression.
    : [];

  //> Variable declaration.
  const tasteRubric = normalizeTasteRubric(record.tasteRubric);

  //> Return a value.
  return {
    //> Source statement or expression.
    localProjectFolder,
    //> Source statement or expression.
    agents,
    //> Source statement or expression.
    projects,
    //> Source statement or expression.
    tasteRubric,
    //> Source statement or expression.
    updatedAt: asString(record.updatedAt) || base.updatedAt
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function ensureSettingsDir() {
  //> Variable declaration.
  const file = settingsPath();
  //> Await async value.
  await fs.mkdir(path.dirname(file), { recursive: true });
  //> Return a value.
  return file;
//> Brace or statement terminator.
}

//> Export declaration.
export async function readMVPFactoryControlSettings(): Promise<MVPFactoryControlSettings> {
  //> Variable declaration.
  const file = await ensureSettingsDir();
  //> Try block start.
  try {
    //> Variable declaration.
    const raw = await fs.readFile(file, "utf8");
    //> Return a value.
    return normalizeSettings(JSON.parse(raw));
  //> Source statement or expression.
  } catch {
    //> Variable declaration.
    const defaults = defaultSettings();
    //> Await async value.
    await writeMVPFactoryControlSettings(defaults);
    //> Return a value.
    return defaults;
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Export declaration.
export async function writeMVPFactoryControlSettings(input: MVPFactoryControlSettings) {
  //> Variable declaration.
  const file = await ensureSettingsDir();
  //> Variable declaration.
  const next = {
    //> Source statement or expression.
    ...input,
    //> Source statement or expression.
    updatedAt: new Date().toISOString()
  //> Brace or statement terminator.
  };
  //> Await async value.
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
//> Brace or statement terminator.
}

//> Export declaration.
export function getActiveTasteRubricVersion(settings: MVPFactoryControlSettings): TasteRubricVersion | null {
  //> Variable declaration.
  const rubric = settings.tasteRubric;
  //> Conditional branch.
  if (!rubric || !rubric.versions.length) return null;
  //> Return a value.
  return (
    //> Source statement or expression.
    rubric.versions.find((row) => row.version === rubric.activeVersion) || rubric.versions[0]
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}
