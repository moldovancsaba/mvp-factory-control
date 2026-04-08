/**
 * **Agents** admin UI: Prisma agents, readiness checklists, GitHub board reconciliation, lease snapshot, workers.
 *
 * Forms post to `agents/actions.ts`. Permission matrix from `lifecycle-policy` for documentation in-page.
 */
//> Import bindings from a module.
import { redirect } from "next/navigation";
//> Import bindings from a module.
import { Shell } from "@/components/Shell";
//> Import bindings from a module.
import { getProjectMeta, reconcileBoardAgentOptions } from "@/lib/github";
//> Import bindings from a module.
import { buildAgentReadinessChecklist } from "@/lib/agent-readiness";
//> Import bindings from a module.
import { permissionMatrixRows } from "@/lib/lifecycle-policy";
//> Import bindings from a module.
import { getOrchestratorLeaseSnapshot } from "@/lib/orchestrator-lease";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { readMVPFactoryControlSettings } from "@/lib/settings-store";
//> Import bindings from a module.
import { requireSession } from "@/lib/session";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  isRuntimeRunnable,
  //> Source statement or expression.
  listRunningWorkers
//> Source statement or expression.
} from "@/lib/worker-process";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  createAgentAction,
  //> Source statement or expression.
  adminOverrideManualRequiredAction,
  //> Source statement or expression.
  deleteAgentConfigAction,
  //> Source statement or expression.
  mergeCaseVariantAgentKeysAction,
  //> Source statement or expression.
  saveAgentConfigAction,
  //> Source statement or expression.
  startAgentWorkerAction,
  //> Source statement or expression.
  stopAgentWorkerAction,
  //> Source statement or expression.
  updateAgentReadinessAction,
  //> Source statement or expression.
  updateAgentSmokeTestAction
//> Source statement or expression.
} from "@/app/agents/actions";
//> Import bindings from a module.
import { badgeClassName, buttonClassName } from "@/components/ui";

//> Function declaration.
function heartbeatStatus(a: {
  //> Source statement or expression.
  runtime: string;
  //> Source statement or expression.
  lastHeartbeatAt: Date | null;
  //> Source statement or expression.
  runnable: boolean;
  //> Source statement or expression.
  isRunning: boolean;
//> Source statement or expression.
}) {
  //> Conditional branch.
  if (a.runtime === "MANUAL") return { label: "MANUAL", tone: "muted" as const };
  // For runnable agents, process state is authoritative for immediate online/offline UX.
  //> Conditional branch.
  if (a.runnable && !a.isRunning) return { label: "OFFLINE", tone: "bad" as const };
  //> Conditional branch.
  if (!a.lastHeartbeatAt) return { label: "OFFLINE", tone: "bad" as const };
  //> Variable declaration.
  const ageMs = Date.now() - a.lastHeartbeatAt.getTime();
  //> Conditional branch.
  if (ageMs <= 15_000) return { label: "ONLINE", tone: "good" as const };
  //> Conditional branch.
  if (ageMs <= 60_000) return { label: "STALE", tone: "warn" as const };
  //> Return a value.
  return { label: "OFFLINE", tone: "bad" as const };
//> Brace or statement terminator.
}

//> Function declaration.
function readinessRank(readiness: "NOT_READY" | "READY" | "PAUSED") {
  //> Conditional branch.
  if (readiness === "READY") return 3;
  //> Conditional branch.
  if (readiness === "PAUSED") return 2;
  //> Return a value.
  return 1;
//> Brace or statement terminator.
}

//> Function declaration.
function pickRecommendedCanonicalKey(
  //> Source statement or expression.
  agents: Array<{
    //> Source statement or expression.
    key: string;
    //> Source statement or expression.
    runtime: "MANUAL" | "LOCAL" | "CLOUD";
    //> Source statement or expression.
    readiness: "NOT_READY" | "READY" | "PAUSED";
    //> Source statement or expression.
    enabled: boolean;
    //> Source statement or expression.
    smokeTestPassedAt: Date | null;
    //> Source statement or expression.
    lastHeartbeatAt: Date | null;
  //> Delimiter or separator.
  }>,
  //> Source statement or expression.
  taskCountByKey: Map<string, number>
//> Source statement or expression.
) {
  //> Return a value.
  return agents
    //> Source statement or expression.
    .slice()
    //> Source statement or expression.
    .sort((a, b) => {
      //> Variable declaration.
      const scoreA =
        //> Source statement or expression.
        (isRuntimeRunnable(a.runtime) ? 100 : 0) +
        //> Source statement or expression.
        (a.enabled ? 30 : 0) +
        //> Source statement or expression.
        readinessRank(a.readiness) * 10 +
        //> Source statement or expression.
        (a.smokeTestPassedAt ? 8 : 0) +
        //> Source statement or expression.
        (a.lastHeartbeatAt ? 6 : 0) +
        //> Source statement or expression.
        Math.min(taskCountByKey.get(a.key) || 0, 20);
      //> Variable declaration.
      const scoreB =
        //> Source statement or expression.
        (isRuntimeRunnable(b.runtime) ? 100 : 0) +
        //> Source statement or expression.
        (b.enabled ? 30 : 0) +
        //> Source statement or expression.
        readinessRank(b.readiness) * 10 +
        //> Source statement or expression.
        (b.smokeTestPassedAt ? 8 : 0) +
        //> Source statement or expression.
        (b.lastHeartbeatAt ? 6 : 0) +
        //> Source statement or expression.
        Math.min(taskCountByKey.get(b.key) || 0, 20);
      //> Conditional branch.
      if (scoreB !== scoreA) return scoreB - scoreA;
      //> Return a value.
      return a.key.localeCompare(b.key);
    //> Source statement or expression.
    })[0]?.key;
//> Brace or statement terminator.
}

//> Function declaration.
function leaseHealthClass(health: "HEALTHY" | "EXPIRING" | "STALE" | "UNHELD") {
  //> Conditional branch.
  if (health === "HEALTHY") {
    //> Return a value.
    return badgeClassName("success");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (health === "EXPIRING") {
    //> Return a value.
    return badgeClassName("warning");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (health === "STALE") {
    //> Return a value.
    return badgeClassName("danger");
  //> Brace or statement terminator.
  }
  //> Return a value.
  return badgeClassName();
//> Brace or statement terminator.
}

//> Function declaration.
function formatLeaseTtl(ttlMs: number | null) {
  //> Conditional branch.
  if (ttlMs === null) return "(n/a)";
  //> Conditional branch.
  if (ttlMs <= 0) return "expired";
  //> Conditional branch.
  if (ttlMs < 1_000) return "<1s";
  //> Return a value.
  return `${Math.ceil(ttlMs / 1000)}s`;
//> Brace or statement terminator.
}

//> Function declaration.
function getTasteRubricVersion(metadata: unknown) {
  //> Conditional branch.
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  //> Const with function or expression.
  const value = (metadata as Record<string, unknown>).tasteRubricVersion;
  //> Conditional branch.
  if (typeof value !== "string" || !value.trim()) return null;
  //> Return a value.
  return value.trim();
//> Brace or statement terminator.
}

//> Export declaration.
export default async function AgentsPage() {
  //> Variable declaration.
  const session = await requireSession();
  //> Conditional branch.
  if (!session) redirect("/signin");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  let boardAgents: string[] = [];
  //> Variable declaration.
  let boardLoadError: string | null = null;
  //> Try block start.
  try {
    //> Variable declaration.
    const meta = await getProjectMeta();
    //> Variable declaration.
    const agentField = meta.fields.find((f) => f.name === "Agent");
    //> Source statement or expression.
    boardAgents = agentField?.options?.map((o) => o.name) ?? [];
  //> Source statement or expression.
  } catch (e) {
    //> Source statement or expression.
    boardLoadError = e instanceof Error ? e.message : String(e);
  //> Brace or statement terminator.
  }

  // Seed settings-only agent configs into local registry.
  //> For-loop header.
  for (const row of settings.agents) {
    // eslint-disable-next-line no-await-in-loop
    //> Variable declaration.
    const existing = await prisma.agent.findFirst({
      //> Source statement or expression.
      where: { key: { equals: row.agentName, mode: "insensitive" } },
      //> Source statement or expression.
      select: { key: true }
    //> Brace or statement terminator.
    });
    //> Conditional branch.
    if (existing?.key) continue;
    // eslint-disable-next-line no-await-in-loop
    //> Await async value.
    await prisma.agent.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        key: row.agentName,
        //> Source statement or expression.
        displayName: row.agentName,
        //> Source statement or expression.
        runtime: "MANUAL"
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const dbAgents = await prisma.agent.findMany({ orderBy: { displayName: "asc" } });
  //> Variable declaration.
  const visibleAgents = dbAgents.filter((a) => a.runtime !== "MANUAL");
  //> Variable declaration.
  const boardAgentReconciliation = reconcileBoardAgentOptions({
    //> Source statement or expression.
    boardAgentOptions: boardAgents,
    //> Source statement or expression.
    dbAgents: visibleAgents.map((a) => ({
      //> Source statement or expression.
      key: a.key,
      //> Source statement or expression.
      displayName: a.displayName,
      //> Source statement or expression.
      enabled: a.enabled,
      //> Source statement or expression.
      runtime: a.runtime
    //> Delimiter or separator.
    }))
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const taskCounts = await prisma.agentTask.groupBy({
    //> Source statement or expression.
    by: ["agentKey"],
    //> Source statement or expression.
    _count: { _all: true }
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const taskCountByKey = new Map(taskCounts.map((row) => [row.agentKey, row._count._all]));
  //> Variable declaration.
  const settingsByAgentName = new Map(
    //> Source statement or expression.
    settings.agents.map((row) => [row.agentName.toLowerCase(), row])
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const boardAgentSet = new Set(boardAgents.map((k) => k.toLowerCase()));
  //> Variable declaration.
  const runningWorkers = listRunningWorkers();
  //> Variable declaration.
  const leaseSnapshot = await getOrchestratorLeaseSnapshot();
  //> Variable declaration.
  const lifecycleRows = permissionMatrixRows();
  //> Variable declaration.
  const lifecycleAudits = await prisma.lifecycleAuditEvent.findMany({
    //> Source statement or expression.
    orderBy: { createdAt: "desc" },
    //> Source statement or expression.
    take: 10
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const runningKeys = new Set(
    //> Source statement or expression.
    runningWorkers.map((w) => w.agentKey).filter(Boolean) as string[]
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const duplicateGroups = Array.from(
    //> Source statement or expression.
    dbAgents.reduce((acc, row) => {
      //> Variable declaration.
      const key = row.key.toLowerCase();
      //> Variable declaration.
      const existing = acc.get(key);
      //> Conditional branch.
      if (existing) existing.push(row);
      //> Else branch.
      else acc.set(key, [row]);
      //> Return a value.
      return acc;
    //> Source statement or expression.
    }, new Map<string, typeof dbAgents>())
  //> Delimiter or separator.
  )
    //> Source statement or expression.
    .map(([lowerKey, rows]) => ({
      //> Source statement or expression.
      lowerKey,
      //> Source statement or expression.
      rows: rows.sort((a, b) => a.key.localeCompare(b.key))
    //> Delimiter or separator.
    }))
    //> Source statement or expression.
    .filter((group) => group.rows.length > 1)
    //> Source statement or expression.
    .sort((a, b) => a.lowerKey.localeCompare(b.lowerKey));
  //> Variable declaration.
  const alphaCount = visibleAgents.filter((a) => a.controlRole === "ALPHA").length;
  //> Variable declaration.
  const betaCount = visibleAgents.filter((a) => a.controlRole !== "ALPHA").length;

  //> Return a value.
  return (
    <Shell
      title="Agents"
      subtitle="Local agent registry (DB) with optional board-linked discovery"
    >
      <div className="ui-panel ui-panel--compact ui-stack-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Orchestrator hard lease</div>
            <div className="mt-1 text-xs text-white/65">
              Single-authority lock for task lifecycle writes.
            </div>
          </div>
          <div
            className={`rounded-full border px-2 py-0.5 text-xs ${leaseHealthClass(
              leaseSnapshot.health
            )}`}
          >
            {leaseSnapshot.health}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-white/75 md:grid-cols-2">
          <div className="ui-subpanel">
            <div>
              Holder:{" "}
              <span className="font-mono text-white/85">
                {leaseSnapshot.ownerId || "(none)"}
              </span>
            </div>
            <div className="mt-1 text-white/60">
              Agent:{" "}
              {leaseSnapshot.ownerAgentKey
                ? `@${leaseSnapshot.ownerAgentKey} (${leaseSnapshot.ownerAgentRole || "unknown"})`
                : "(n/a)"}
            </div>
            <div className="mt-1 text-white/60">
              Host/PID:{" "}
              {leaseSnapshot.ownerHost
                ? `${leaseSnapshot.ownerHost}:${leaseSnapshot.ownerPid ?? "?"}`
                : "(n/a)"}
            </div>
          </div>
          <div className="ui-subpanel">
            <div>
              TTL: <span className="font-mono text-white/85">{formatLeaseTtl(leaseSnapshot.ttlMs)}</span>
            </div>
            <div className="mt-1 text-white/60">
              Expires:{" "}
              {leaseSnapshot.expiresAt
                ? new Date(leaseSnapshot.expiresAt).toLocaleString()
                : "(none)"}
            </div>
            <div className="mt-1 text-white/60">
              Last heartbeat:{" "}
              {leaseSnapshot.lastHeartbeatAt
                ? new Date(leaseSnapshot.lastHeartbeatAt).toLocaleString()
                : "(none)"}
            </div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-white/55">
          Last audit:{" "}
          {leaseSnapshot.lastAudit
            ? `${leaseSnapshot.lastAudit.code} @ ${new Date(
                leaseSnapshot.lastAudit.createdAt
              ).toLocaleString()}`
            : "(none)"}
        </div>
        {leaseSnapshot.lastAudit ? (
          <div className="mt-1 text-[11px] text-white/70">{leaseSnapshot.lastAudit.message}</div>
        ) : null}
      </div>
      <div className="ui-panel ui-panel--compact ui-stack-md">
        <div className="text-sm font-semibold">Permission matrix + lifecycle audit</div>
        <div className="mt-1 text-xs text-white/65">
          Deterministic transition policy (allowed/denied with explicit reasons).
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className={badgeClassName("accent")}>
            ALPHA agents: {alphaCount}
          </span>
          <span className={badgeClassName("accent")}>
            BETA agents: {betaCount}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {lifecycleRows.map((row) => (
            <div
              key={row.role}
              className="ui-subpanel text-xs text-white/75"
            >
              <div className="font-mono text-[11px] text-white/80">{row.role}</div>
              <div className="mt-1 text-white/70">Allowed: {row.allowed}</div>
              <div className="mt-1 text-white/55">Denied: {row.denied}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-white/60">Recent lifecycle events</div>
        <div className="mt-2 space-y-1.5">
          {lifecycleAudits.map((event) => {
            const tasteRubricVersion = getTasteRubricVersion(event.metadata);
            return (
              <div
                key={event.id}
                className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[11px]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-1.5 py-0.5 ${
                      event.allowed
                        ? "border-emerald-300/25 bg-emerald-200/10 text-emerald-100"
                        : "border-rose-300/25 bg-rose-200/10 text-rose-100"
                    }`}
                  >
                    {event.allowed ? "ALLOW" : "DENY"}
                  </span>
                  <span className="font-mono text-white/75">
                    {event.actorRole}:{event.action}
                  </span>
                  <span className="text-white/50">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-white/70">
                  {event.entityType}:{event.entityId || "(n/a)"} {event.fromState || "(n/a)"} -&gt;{" "}
                  {event.toState || "(n/a)"}
                </div>
                <div className="mt-0.5 text-white/55">{event.reason}</div>
                {tasteRubricVersion ? (
                  <div className="mt-0.5 text-white/55">
                    Taste rubric:{" "}
                    <span className="font-mono text-white/75">{tasteRubricVersion}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
          {lifecycleAudits.length === 0 ? (
            <div className="text-[11px] text-white/55">(no lifecycle events yet)</div>
          ) : null}
        </div>
      </div>
      <div className="ui-panel ui-panel--compact ui-stack-md">
        <div className="text-sm font-semibold">Add agent</div>
        <div className="mt-1 text-xs text-white/60">
          Creates (or updates) an agent in local registry. New/changed runtime starts as `NOT_READY`.
        </div>
        <form action={createAgentAction} className="mt-3 grid gap-2 sm:grid-cols-6">
          <label className="text-[11px] text-white/65 sm:col-span-2">
            Agent key
            <input
              name="agentKey"
              placeholder="Nova"
              className="mt-1 ui-input text-xs"
            />
          </label>
          <label className="text-[11px] text-white/65">
            Display name
            <input
              name="displayName"
              placeholder="Nova"
              className="mt-1 ui-input text-xs"
            />
          </label>
          <label className="text-[11px] text-white/65">
            Runtime
            <select
              name="runtime"
              defaultValue="CLOUD"
              className="mt-1 ui-input text-xs"
            >
              <option value="CLOUD">CLOUD</option>
              <option value="LOCAL">LOCAL</option>
            </select>
          </label>
          <label className="text-[11px] text-white/65">
            Role
            <select
              name="controlRole"
              defaultValue="BETA"
              className="mt-1 ui-input text-xs"
            >
              <option value="BETA">BETA</option>
              <option value="ALPHA">ALPHA</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <input type="hidden" name="enabled" value="0" />
            <label className="flex items-center gap-1 text-[11px] text-white/65">
              <input
                type="checkbox"
                name="enabled"
                value="1"
                defaultChecked
                className="h-3.5 w-3.5 rounded border border-white/20 bg-black/30"
              />
              Enabled
            </label>
            <button
              type="submit"
              className={buttonClassName("success") + " min-h-0 px-2.5 py-1 text-[11px]"}
            >
              Add
            </button>
          </div>
        </form>
      </div>
      <div className="ui-panel ui-panel--compact ui-stack-md">
        <div className="text-sm font-semibold">Board Agent integrity</div>
        <div className="mt-1 text-xs text-white/65">
          Reconciliation between GitHub Project <code>Agent</code> options and DB runtime agents.
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className={badgeClassName("success")}>
            Mapped: {boardAgentReconciliation.mappedCount}
          </span>
          <span className={badgeClassName("warning")}>
            Unmapped board options: {boardAgentReconciliation.unmappedCount}
          </span>
          <span className="rounded-full border border-cyan-300/25 bg-cyan-200/10 px-2 py-0.5 text-cyan-50">
            DB-only runtime agents: {boardAgentReconciliation.dbOnlyAgents.length}
          </span>
        </div>
        {boardAgentReconciliation.unmappedCount ? (
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
            Board options without DB runtime match:{" "}
            {boardAgentReconciliation.optionRows
              .filter((row) => row.status === "UNMAPPED")
              .map((row) => row.boardOption)
              .join(", ")}
          </div>
        ) : null}
        {boardAgentReconciliation.dbOnlyAgents.length ? (
          <div className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-100">
            Runtime DB agents not present as board options:{" "}
            {boardAgentReconciliation.dbOnlyAgents
              .map((row) => `@${row.key}`)
              .join(", ")}
          </div>
        ) : null}
      </div>
      {duplicateGroups.length ? (
        <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-200/10 p-4">
          <div className="text-sm font-semibold text-amber-100">
            Legacy case-variant duplicate keys
          </div>
          <div className="mt-1 text-xs text-amber-100/80">
            Safe merge will reassign all <code>AgentTask.agentKey</code> rows first, then remove the duplicate
            agent rows. Task history stays intact.
          </div>
          <div className="mt-3 space-y-2">
            {duplicateGroups.map((group) => {
              const recommended = pickRecommendedCanonicalKey(
                group.rows.map((row) => ({
                  key: row.key,
                  runtime: row.runtime,
                  readiness: row.readiness ?? "NOT_READY",
                  enabled: row.enabled,
                  smokeTestPassedAt: row.smokeTestPassedAt,
                  lastHeartbeatAt: row.lastHeartbeatAt
                })),
                taskCountByKey
              );
              return (
                <form
                  key={group.lowerKey}
                  action={mergeCaseVariantAgentKeysAction}
                  className="rounded-xl border border-amber-200/20 bg-black/20 p-3"
                >
                  <div className="text-xs font-semibold text-amber-50">
                    {group.rows.map((row) => `@${row.key}`).join(", ")}
                  </div>
                  <div className="mt-1 text-[11px] text-amber-100/75">
                    Choose canonical key:
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      name="canonicalKey"
                      defaultValue={recommended}
                      className="rounded-lg border border-amber-200/20 bg-black/30 px-2 py-1 text-[11px] text-amber-50"
                    >
                      {group.rows.map((row) => (
                        <option key={row.key} value={row.key}>
                          {row.key} · {row.runtime} · {row.readiness ?? "NOT_READY"} · tasks:
                          {taskCountByKey.get(row.key) || 0}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className={buttonClassName("secondary") + " min-h-0 px-2.5 py-1 text-[11px]"}
                    >
                      Merge variants
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </div>
      ) : null}
      {boardLoadError ? (
        <div className="mb-3 rounded-xl border border-amber-300/25 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
          GitHub board agent sync unavailable: {boardLoadError}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {visibleAgents.map((a) => {
          const key = a.key;
          const agentConfig = settingsByAgentName.get(key.toLowerCase()) || null;
          const runnable =
            isRuntimeRunnable(a.runtime) && a.enabled && a.controlRole === "ALPHA";
          const isRunning = runningKeys.has(key);
          const readiness = a.readiness ?? "NOT_READY";
          const checklist = buildAgentReadinessChecklist({
            agent: a,
            config: agentConfig,
            isRunning
          });
          const hb = heartbeatStatus({
            runtime: a.runtime,
            lastHeartbeatAt: a.lastHeartbeatAt,
            runnable,
            isRunning
          });
          const statusClass =
            hb?.tone === "good"
              ? "border-emerald-300/25 bg-emerald-200/10 text-emerald-50"
              : hb?.tone === "warn"
              ? "border-amber-300/25 bg-amber-200/10 text-amber-50"
              : hb?.tone === "bad"
              ? "border-rose-300/25 bg-rose-200/10 text-rose-50"
              : "border-white/15 bg-white/5 text-white/70";
          const readinessClass =
            readiness === "READY"
              ? "border-emerald-300/25 bg-emerald-200/10 text-emerald-50"
              : readiness === "PAUSED"
              ? "border-amber-300/25 bg-amber-200/10 text-amber-50"
              : "border-rose-300/25 bg-rose-200/10 text-rose-50";

          return (
            <div
              key={key}
              className="ui-panel ui-stack-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">{a.displayName || key}</div>
                <div className="flex items-center gap-2">
                  <div className={`rounded-full border px-2 py-0.5 text-xs ${statusClass}`}>
                    {hb.label}
                  </div>
                  <div className={badgeClassName()}>
                    {a.runtime}
                  </div>
                  <div
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      a.enabled
                        ? "border-emerald-300/25 bg-emerald-200/10 text-emerald-50"
                        : "border-rose-300/25 bg-rose-200/10 text-rose-50"
                    }`}
                  >
                    {a.enabled ? "Enabled" : "Disabled"}
                  </div>
                  <div className={`rounded-full border px-2 py-0.5 text-xs ${readinessClass}`}>
                    {readiness}
                  </div>
                  <div
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      a.controlRole === "ALPHA"
                        ? "border-cyan-300/25 bg-cyan-200/10 text-cyan-50"
                        : "border-indigo-300/25 bg-indigo-200/10 text-indigo-50"
                    }`}
                  >
                    {a.controlRole}
                  </div>
                  <div className={badgeClassName()}>
                    {boardAgentSet.has(key.toLowerCase()) ? "Board-linked" : "Local-only"}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-sm text-white/70">
                Model: {a.model ?? "(not set)"}{" "}
              </div>
              <div className="mt-1 text-sm text-white/70">
                Host: {a.host ?? "(not set)"}
              </div>
              <div className="mt-1 text-xs text-white/60 font-mono">
                Last heartbeat: {a.lastHeartbeatAt ? new Date(a.lastHeartbeatAt).toLocaleString() : "(none)"}
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="text-xs font-semibold text-white/75">Readiness checklist</div>
                <div className="mt-2 space-y-1.5">
                  {checklist?.items.map((item) => (
                    <div key={item.key} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-white/75">{item.label}</span>
                        <span className={item.ok ? "text-emerald-200" : "text-rose-200"}>
                          {item.ok ? "PASS" : "FAIL"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/60">{item.detail}</div>
                    </div>
                  ))}
                </div>
                {!checklist?.checklistReady ? (
                  <div className="mt-2 text-[11px] text-rose-100/85">
                    Blocked until all checks pass.
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-emerald-100/85">
                    Checklist complete.
                  </div>
                )}
                <form action={updateAgentReadinessAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="agentKey" value={key} />
                  <select
                    name="readiness"
                    defaultValue={readiness}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px] text-white/90"
                  >
                    <option value="NOT_READY">NOT_READY</option>
                    <option value="READY">READY</option>
                    <option value="PAUSED">PAUSED</option>
                  </select>
                  <button
                    type="submit"
                    className={buttonClassName("secondary") + " min-h-0 px-2.5 py-1 text-[11px]"}
                  >
                    Set readiness
                  </button>
                </form>
                <div className="mt-2 flex items-center gap-2">
                  <form action={updateAgentSmokeTestAction}>
                    <input type="hidden" name="agentKey" value={key} />
                    <input type="hidden" name="passed" value="1" />
                    <button
                      type="submit"
                      className={buttonClassName("success") + " min-h-0 px-2.5 py-1 text-[11px]"}
                    >
                      Mark smoke PASS
                    </button>
                  </form>
                  <form action={updateAgentSmokeTestAction}>
                    <input type="hidden" name="agentKey" value={key} />
                    <input type="hidden" name="passed" value="0" />
                    <button
                      type="submit"
                      className={buttonClassName("secondary") + " min-h-0 px-2.5 py-1 text-[11px]"}
                    >
                      Reset smoke
                    </button>
                  </form>
                </div>
                <form action={adminOverrideManualRequiredAction} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="agentKey" value={key} />
                  <input
                    type="hidden"
                    name="reason"
                    value="Manual override from /agents: force queued/running tasks to MANUAL_REQUIRED."
                  />
                  <button
                    type="submit"
                    className={buttonClassName("secondary") + " min-h-0 px-2.5 py-1 text-[11px]"}
                  >
                    Admin override -&gt; MANUAL_REQUIRED
                  </button>
                </form>
              </div>
              <div className="mt-4 text-xs text-white/60">
                v1: registry is local. Next: enable/disable, cost class, allowed repos, worker heartbeat.
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="text-xs font-semibold text-white/75">Agent config</div>
                <div className="mt-1 text-[11px] text-white/55">
                  API keys stay in env files. Store only env var names here.
                </div>
                <form action={saveAgentConfigAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="agentId" value={agentConfig?.agentId ?? ""} />
                  <input type="hidden" name="agentName" value={key} />
                  <div className="text-[11px] text-white/60 font-mono">
                    id: {agentConfig?.agentId ?? "(auto-generated on first save)"}
                  </div>
                  <label className="text-[11px] text-white/65">
                    API URL
                    <input
                      name="agentUrl"
                      defaultValue={agentConfig?.agentUrl ?? ""}
                      placeholder="https://api.openai.com/v1"
                      className="mt-1 ui-input text-xs"
                    />
                  </label>
                  <label className="text-[11px] text-white/65">
                    Model
                    <input
                      name="agentModel"
                      defaultValue={agentConfig?.agentModel ?? ""}
                      placeholder="gpt-4.1-nano"
                      className="mt-1 ui-input text-xs"
                    />
                  </label>
                  <label className="text-[11px] text-white/65">
                    API key env var
                    <input
                      name="agentApiKeyEnv"
                      defaultValue={agentConfig?.agentApiKeyEnv ?? ""}
                      placeholder="OPENAI_API_KEY"
                      className="mt-1 ui-input text-xs"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className={buttonClassName("secondary") + " min-h-0 px-2.5 py-1 text-[11px]"}
                    >
                      Save config
                    </button>
                  </div>
                </form>
                {agentConfig ? (
                  <form action={deleteAgentConfigAction} className="mt-2">
                    <input type="hidden" name="agentId" value={agentConfig.agentId} />
                    <input type="hidden" name="agentName" value={key} />
                    <button
                      type="submit"
                      className={buttonClassName("danger") + " min-h-0 px-2.5 py-1 text-[11px]"}
                    >
                      Delete config
                    </button>
                  </form>
                ) : null}
              </div>
              {runnable ? (
                <div className="mt-4 flex items-center gap-2">
                  {!isRunning ? (
                    <form action={startAgentWorkerAction}>
                      <input type="hidden" name="agentKey" value={key} />
                      <button
                        type="submit"
                        className={buttonClassName("success")}
                      >
                        Start Worker
                      </button>
                    </form>
                  ) : (
                    <form action={stopAgentWorkerAction}>
                      <input type="hidden" name="agentKey" value={key} />
                      <button
                        type="submit"
                        className={buttonClassName("danger")}
                      >
                        Stop Worker
                      </button>
                    </form>
                  )}
                  <div className="text-xs text-white/65">
                    {isRunning ? "Process running" : "Process stopped"}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-xs text-white/55">
                  {!a.enabled
                    ? "Agent is disabled."
                    : a.controlRole !== "ALPHA"
                    ? "BETA role: execution-only (cannot run control-plane worker)."
                    : "Manual agent (no runnable worker in this version)."}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {visibleAgents.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/70">
          No runnable agents yet. Configure at least one agent with runtime `LOCAL` or `CLOUD`.
        </div>
      ) : null}
    </Shell>
  );
//> Brace or statement terminator.
}
