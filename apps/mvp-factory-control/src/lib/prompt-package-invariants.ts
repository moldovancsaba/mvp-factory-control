/**
 * Persisted **invariants** for executable prompt packages and alpha context packages (hashes, snapshots).
 *
 * Records rows for audit and idempotency; uses SHA-256 over normalized JSON. Integrates with task enqueue
 * and alpha context mutations inside Prisma transactions where passed a transaction client.
 */
//> Import bindings from a module.
import { createHash } from "node:crypto";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import type { AlphaContextPackageSnapshotKind, Prisma } from "@prisma/client";

//> Type or interface definition.
type InvariantDb = Prisma.TransactionClient | typeof prisma;

//> Function declaration.
function normalizeText(input: string | null | undefined) {
  //> Return a value.
  return String(input || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeProjectKey(projectName: string) {
  //> Return a value.
  return normalizeText(projectName).toLowerCase();
//> Brace or statement terminator.
}

//> Function declaration.
function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  //> Conditional branch.
  if (value === undefined || value === null) return undefined;
  //> Return a value.
  return value as Prisma.InputJsonValue;
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeForHash(value: unknown): unknown {
  //> Conditional branch.
  if (value === null || value === undefined) return null;
  //> Conditional branch.
  if (value instanceof Date) return value.toISOString();
  //> Conditional branch.
  if (typeof value === "bigint") return value.toString();
  //> Conditional branch.
  if (Array.isArray(value)) return value.map((entry) => normalizeForHash(entry));
  //> Conditional branch.
  if (typeof value === "object") {
    //> Variable declaration.
    const record = value as Record<string, unknown>;
    //> Variable declaration.
    const out: Record<string, unknown> = {};
    //> For-loop header.
    for (const key of Object.keys(record).sort()) {
      //> Source statement or expression.
      out[key] = normalizeForHash(record[key]);
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
function computeSnapshotHash(value: unknown) {
  //> Variable declaration.
  const canonical = JSON.stringify(normalizeForHash(value));
  //> Return a value.
  return createHash("sha256").update(canonical).digest("hex");
//> Brace or statement terminator.
}

//> Export declaration.
export type TaskPromptPackageSnapshotInput = {
  //> Source statement or expression.
  sourceKind: string;
  //> Source statement or expression.
  sourceRef?: string | null;
  //> Source statement or expression.
  issueNumber?: number | null;
  //> Source statement or expression.
  promptText: string;
  //> Source statement or expression.
  packageBody?: string | null;
  //> Source statement or expression.
  packageSections?: unknown;
  //> Source statement or expression.
  payloadSnapshot?: unknown;
//> Brace or statement terminator.
};

//> Export declaration.
export async function recordTaskPromptPackageInvariant(params: {
  //> Source statement or expression.
  db: InvariantDb;
  //> Source statement or expression.
  taskId: string;
  //> Source statement or expression.
  snapshot: TaskPromptPackageSnapshotInput;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const issueNumber =
    //> Source statement or expression.
    typeof params.snapshot.issueNumber === "number" && Number.isFinite(params.snapshot.issueNumber)
      //> Source statement or expression.
      ? Math.trunc(params.snapshot.issueNumber)
      //> Source statement or expression.
      : null;
  //> Variable declaration.
  const sourceKind = normalizeText(params.snapshot.sourceKind) || "TASK_INPUT_FALLBACK";
  //> Variable declaration.
  const sourceRef = normalizeText(params.snapshot.sourceRef) || null;
  //> Variable declaration.
  const promptText = normalizeText(params.snapshot.promptText) || "(untitled task)";
  //> Variable declaration.
  const packageBody = normalizeText(params.snapshot.packageBody) || null;

  //> Variable declaration.
  const sectionsJson = toJsonValue(params.snapshot.packageSections);
  //> Variable declaration.
  const payloadJson = toJsonValue(params.snapshot.payloadSnapshot);
  //> Variable declaration.
  const snapshotHash = computeSnapshotHash({
    //> Source statement or expression.
    taskId: params.taskId,
    //> Source statement or expression.
    sourceKind,
    //> Source statement or expression.
    sourceRef,
    //> Source statement or expression.
    issueNumber,
    //> Source statement or expression.
    promptText,
    //> Source statement or expression.
    packageBody,
    //> Source statement or expression.
    packageSections: sectionsJson ?? null,
    //> Source statement or expression.
    payloadSnapshot: payloadJson ?? null
  //> Brace or statement terminator.
  });

  //> Return a value.
  return params.db.taskPromptPackageInvariant.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      taskId: params.taskId,
      //> Source statement or expression.
      sourceKind,
      //> Source statement or expression.
      sourceRef,
      //> Source statement or expression.
      issueNumber,
      //> Source statement or expression.
      snapshotHash,
      //> Source statement or expression.
      promptText,
      //> Source statement or expression.
      packageBody,
      //> Source statement or expression.
      packageSections: sectionsJson,
      //> Source statement or expression.
      payloadSnapshot: payloadJson
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export type TaskPromptPackageInvariantSummary = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  taskId: string;
  //> Source statement or expression.
  issueNumber: number | null;
  //> Source statement or expression.
  sourceKind: string;
  //> Source statement or expression.
  sourceRef: string | null;
  //> Source statement or expression.
  snapshotHash: string;
  //> Source statement or expression.
  promptText: string;
  //> Source statement or expression.
  createdAt: string;
  //> Source statement or expression.
  task: {
    //> Source statement or expression.
    status: string;
    //> Source statement or expression.
    title: string;
    //> Source statement or expression.
    agentKey: string;
    //> Source statement or expression.
    createdAt: string;
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
};

//> Export declaration.
export async function listIssueTaskPromptPackageInvariants(params: {
  //> Source statement or expression.
  issueNumber: number;
  //> Source statement or expression.
  limit?: number;
//> Source statement or expression.
}): Promise<TaskPromptPackageInvariantSummary[]> {
  //> Variable declaration.
  const issueNumber = Math.trunc(params.issueNumber);
  //> Variable declaration.
  const rows = await prisma.taskPromptPackageInvariant.findMany({
    //> Source statement or expression.
    where: { issueNumber },
    //> Source statement or expression.
    include: {
      //> Source statement or expression.
      task: {
        //> Source statement or expression.
        select: {
          //> Source statement or expression.
          status: true,
          //> Source statement or expression.
          title: true,
          //> Source statement or expression.
          agentKey: true,
          //> Source statement or expression.
          createdAt: true
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    orderBy: [{ createdAt: "desc" }],
    //> Source statement or expression.
    take: Math.min(Math.max(params.limit ?? 30, 1), 200)
  //> Brace or statement terminator.
  });

  //> Return a value.
  return rows.map((row) => ({
    //> Source statement or expression.
    id: row.id,
    //> Source statement or expression.
    taskId: row.taskId,
    //> Source statement or expression.
    issueNumber: row.issueNumber,
    //> Source statement or expression.
    sourceKind: row.sourceKind,
    //> Source statement or expression.
    sourceRef: row.sourceRef,
    //> Source statement or expression.
    snapshotHash: row.snapshotHash,
    //> Source statement or expression.
    promptText: row.promptText,
    //> Source statement or expression.
    createdAt: row.createdAt.toISOString(),
    //> Source statement or expression.
    task: {
      //> Source statement or expression.
      status: row.task.status,
      //> Source statement or expression.
      title: row.task.title,
      //> Source statement or expression.
      agentKey: row.task.agentKey,
      //> Source statement or expression.
      createdAt: row.task.createdAt.toISOString()
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  }));
//> Brace or statement terminator.
}

//> Export declaration.
export type AlphaContextPackageInvariantInput = {
  //> Source statement or expression.
  windowId: string;
  //> Source statement or expression.
  projectKey: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  snapshotKind: AlphaContextPackageSnapshotKind;
  //> Source statement or expression.
  sourceRef?: string | null;
  //> Source statement or expression.
  handoverRef?: string | null;
  //> Source statement or expression.
  handoverPackageRef?: string | null;
  //> Source statement or expression.
  continuationPromptRef?: string | null;
  //> Source statement or expression.
  continuityNote?: string | null;
  //> Source statement or expression.
  payloadSnapshot?: unknown;
  //> Source statement or expression.
  createdById?: string | null;
  //> Source statement or expression.
  predecessorSnapshotId?: string | null;
//> Brace or statement terminator.
};

//> Export declaration.
export async function getLatestAlphaContextPackageInvariant(params: {
  //> Source statement or expression.
  db: InvariantDb;
  //> Source statement or expression.
  windowId: string;
//> Source statement or expression.
}) {
  //> Return a value.
  return params.db.alphaContextPackageInvariant.findFirst({
    //> Source statement or expression.
    where: { windowId: params.windowId },
    //> Source statement or expression.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    //> Source statement or expression.
    select: { id: true }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function recordAlphaContextPackageInvariant(params: {
  //> Source statement or expression.
  db: InvariantDb;
  //> Source statement or expression.
  input: AlphaContextPackageInvariantInput;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const projectKey = normalizeText(params.input.projectKey).toLowerCase();
  //> Variable declaration.
  const projectName = normalizeText(params.input.projectName);
  //> Variable declaration.
  const sourceRef = normalizeText(params.input.sourceRef) || null;
  //> Variable declaration.
  const handoverRef = normalizeText(params.input.handoverRef) || null;
  //> Variable declaration.
  const handoverPackageRef = normalizeText(params.input.handoverPackageRef) || null;
  //> Variable declaration.
  const continuationPromptRef = normalizeText(params.input.continuationPromptRef) || null;
  //> Variable declaration.
  const continuityNote = normalizeText(params.input.continuityNote) || null;

  //> Variable declaration.
  const predecessorSnapshotId =
    //> Source statement or expression.
    params.input.predecessorSnapshotId !== undefined
      //> Source statement or expression.
      ? params.input.predecessorSnapshotId
      //> Source statement or expression.
      : (await getLatestAlphaContextPackageInvariant({
          //> Source statement or expression.
          db: params.db,
          //> Source statement or expression.
          windowId: params.input.windowId
        //> Source statement or expression.
        }))?.id || null;

  //> Variable declaration.
  const payloadJson = toJsonValue(params.input.payloadSnapshot);
  //> Variable declaration.
  const snapshotHash = computeSnapshotHash({
    //> Source statement or expression.
    windowId: params.input.windowId,
    //> Source statement or expression.
    projectKey,
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    snapshotKind: params.input.snapshotKind,
    //> Source statement or expression.
    predecessorSnapshotId,
    //> Source statement or expression.
    sourceRef,
    //> Source statement or expression.
    handoverRef,
    //> Source statement or expression.
    handoverPackageRef,
    //> Source statement or expression.
    continuationPromptRef,
    //> Source statement or expression.
    continuityNote,
    //> Source statement or expression.
    payloadSnapshot: payloadJson ?? null
  //> Brace or statement terminator.
  });

  //> Return a value.
  return params.db.alphaContextPackageInvariant.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      windowId: params.input.windowId,
      //> Source statement or expression.
      projectKey,
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      snapshotKind: params.input.snapshotKind,
      //> Source statement or expression.
      predecessorSnapshotId,
      //> Source statement or expression.
      sourceRef,
      //> Source statement or expression.
      snapshotHash,
      //> Source statement or expression.
      handoverRef,
      //> Source statement or expression.
      handoverPackageRef,
      //> Source statement or expression.
      continuationPromptRef,
      //> Source statement or expression.
      continuityNote,
      //> Source statement or expression.
      payloadSnapshot: payloadJson,
      //> Source statement or expression.
      createdById: normalizeText(params.input.createdById) || null
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export type AlphaContextPackageInvariantSummary = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  windowId: string;
  //> Source statement or expression.
  projectKey: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  snapshotKind: AlphaContextPackageSnapshotKind;
  //> Source statement or expression.
  predecessorSnapshotId: string | null;
  //> Source statement or expression.
  sourceRef: string | null;
  //> Source statement or expression.
  snapshotHash: string;
  //> Source statement or expression.
  handoverRef: string | null;
  //> Source statement or expression.
  handoverPackageRef: string | null;
  //> Source statement or expression.
  continuationPromptRef: string | null;
  //> Source statement or expression.
  continuityNote: string | null;
  //> Source statement or expression.
  createdAt: string;
  //> Source statement or expression.
  ownerAgentKey: string;
  //> Source statement or expression.
  windowStatus: string;
//> Brace or statement terminator.
};

//> Export declaration.
export async function listProjectAlphaContextPackageInvariants(params: {
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  limit?: number;
//> Source statement or expression.
}): Promise<AlphaContextPackageInvariantSummary[]> {
  //> Variable declaration.
  const projectKey = normalizeProjectKey(params.projectName);
  //> Conditional branch.
  if (!projectKey) return [];

  //> Variable declaration.
  const rows = await prisma.alphaContextPackageInvariant.findMany({
    //> Source statement or expression.
    where: { projectKey },
    //> Source statement or expression.
    include: {
      //> Source statement or expression.
      window: {
        //> Source statement or expression.
        select: {
          //> Source statement or expression.
          ownerAgentKey: true,
          //> Source statement or expression.
          status: true
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    //> Source statement or expression.
    take: Math.min(Math.max(params.limit ?? 40, 1), 250)
  //> Brace or statement terminator.
  });

  //> Return a value.
  return rows.map((row) => ({
    //> Source statement or expression.
    id: row.id,
    //> Source statement or expression.
    windowId: row.windowId,
    //> Source statement or expression.
    projectKey: row.projectKey,
    //> Source statement or expression.
    projectName: row.projectName,
    //> Source statement or expression.
    snapshotKind: row.snapshotKind,
    //> Source statement or expression.
    predecessorSnapshotId: row.predecessorSnapshotId,
    //> Source statement or expression.
    sourceRef: row.sourceRef,
    //> Source statement or expression.
    snapshotHash: row.snapshotHash,
    //> Source statement or expression.
    handoverRef: row.handoverRef,
    //> Source statement or expression.
    handoverPackageRef: row.handoverPackageRef,
    //> Source statement or expression.
    continuationPromptRef: row.continuationPromptRef,
    //> Source statement or expression.
    continuityNote: row.continuityNote,
    //> Source statement or expression.
    createdAt: row.createdAt.toISOString(),
    //> Source statement or expression.
    ownerAgentKey: row.window.ownerAgentKey,
    //> Source statement or expression.
    windowStatus: row.window.status
  //> Delimiter or separator.
  }));
//> Brace or statement terminator.
}
