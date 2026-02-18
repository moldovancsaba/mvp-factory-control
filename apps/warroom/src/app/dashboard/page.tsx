import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/session";
import { getProjectMeta, listProjectItems } from "@/lib/github";
import { listActiveProjectAlphaLocks } from "@/lib/alpha-context";
import { getOrchestratorIntrospectionSnapshot } from "@/lib/orchestrator-introspection";
import { prisma } from "@/lib/prisma";

function countBy(items: Array<{ fields: Record<string, string> }>, field: string) {
  const out: Record<string, number> = {};
  for (const it of items) {
    const v = it.fields[field] || "(unset)";
    out[v] = (out[v] || 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
}

function formatMs(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

export default async function DashboardPage() {
  const session = await requireSession();
  if (!session) redirect("/signin");

  const dashboardProduct = (process.env.WARROOM_DASHBOARD_PRODUCT || "WarRoom").trim();
  let meta: Awaited<ReturnType<typeof getProjectMeta>> | null = null;
  let items: Awaited<ReturnType<typeof listProjectItems>> = [];
  let emailEvents: Array<{
    id: string;
    status: string;
    senderEmail: string;
    attemptCount: number;
    lastFailureCode: string | null;
    createdAt: Date;
  }> = [];
  let driftEvents: Array<{
    id: string;
    entityId: string | null;
    reason: string;
    metadata: unknown;
    createdAt: Date;
  }> = [];
  let provenanceEvents: Array<{
    id: string;
    entityId: string | null;
    action: string;
    reason: string;
    metadata: unknown;
    createdAt: Date;
  }> = [];
  let recentTasks: Array<{
    id: string;
    status: string;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    deadLetteredAt: Date | null;
    lastFailureCode: string | null;
  }> = [];
  let approvalConsumeEvents: Array<{
    id: string;
    metadata: unknown;
    createdAt: Date;
  }> = [];
  let dlpEvents: Array<{
    id: string;
    metadata: unknown;
    createdAt: Date;
  }> = [];
  let activeAlphaLocks: Awaited<ReturnType<typeof listActiveProjectAlphaLocks>> = [];
  let introspection: Awaited<ReturnType<typeof getOrchestratorIntrospectionSnapshot>> | null = null;
  let introspectionError: string | null = null;
  let boardError: string | null = null;
  let localError: string | null = null;
  const sloWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    [meta, items] = await Promise.all([
      getProjectMeta(),
      listProjectItems({ limit: 200, product: dashboardProduct })
    ]);
  } catch (e) {
    boardError = e instanceof Error ? e.message : String(e);
  }

  try {
    [emailEvents, activeAlphaLocks, driftEvents, provenanceEvents, recentTasks, approvalConsumeEvents, dlpEvents] = await Promise.all([
      prisma.inboundEmailEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          senderEmail: true,
          attemptCount: true,
          lastFailureCode: true,
          createdAt: true
        }
      }),
      listActiveProjectAlphaLocks(30),
      prisma.lifecycleAuditEvent.findMany({
        where: {
          action: "BLOCK_TASK_ON_DRIFT"
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          entityId: true,
          reason: true,
          metadata: true,
          createdAt: true
        }
      }),
      prisma.lifecycleAuditEvent.findMany({
        where: {
          entityType: "TASK_PROVENANCE",
          action: {
            in: ["REGISTER_PROVENANCE_CHAIN", "BIND_APPROVER_TO_CHAIN", "EMIT_GIT_ARTIFACT"]
          }
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          entityId: true,
          action: true,
          reason: true,
          metadata: true,
          createdAt: true
        }
      }),
      prisma.agentTask.findMany({
        where: {
          createdAt: { gte: sloWindowStart }
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          status: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          deadLetteredAt: true,
          lastFailureCode: true
        }
      }),
      prisma.lifecycleAuditEvent.findMany({
        where: {
          entityType: "TOOL_APPROVAL_TOKEN",
          action: "CONSUME_APPROVAL_TOKEN",
          allowed: true,
          createdAt: { gte: sloWindowStart }
        },
        orderBy: { createdAt: "desc" },
        take: 400,
        select: {
          id: true,
          metadata: true,
          createdAt: true
        }
      }),
      prisma.lifecycleAuditEvent.findMany({
        where: {
          action: "DLP_OUTPUT_FILTER",
          createdAt: { gte: sloWindowStart }
        },
        orderBy: { createdAt: "desc" },
        take: 400,
        select: {
          id: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);
  } catch (e) {
    localError = e instanceof Error ? e.message : String(e);
  }

  if (!localError) {
    try {
      introspection = await getOrchestratorIntrospectionSnapshot();
    } catch (e) {
      introspectionError = e instanceof Error ? e.message : String(e);
    }
  }

  const terminalTasks = recentTasks.filter((task) =>
    ["DONE", "DEAD_LETTER", "MANUAL_REQUIRED", "CANCELED"].includes(task.status)
  );
  const taskLatencyMs = recentTasks
    .filter((task) => task.startedAt && task.finishedAt)
    .map((task) => Math.max(0, task.finishedAt!.getTime() - task.startedAt!.getTime()));
  const doneCount = terminalTasks.filter((task) => task.status === "DONE").length;
  const deadLetterCount = terminalTasks.filter((task) => task.status === "DEAD_LETTER").length;
  const manualRequiredCount = terminalTasks.filter((task) => task.status === "MANUAL_REQUIRED").length;
  const failureCount = deadLetterCount + manualRequiredCount;
  const terminalCount = terminalTasks.length;
  const failureRate = terminalCount ? failureCount / terminalCount : 0;
  const deadLetterRate = terminalCount ? deadLetterCount / terminalCount : 0;
  const p50TaskLatency = percentile(taskLatencyMs, 50);
  const p95TaskLatency = percentile(taskLatencyMs, 95);

  const approvalWaitMs = approvalConsumeEvents
    .map((event) => {
      const meta =
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>)
          : null;
      const issuedAtRaw = meta && typeof meta.issuedAt === "string" ? meta.issuedAt : "";
      const issuedAt = Date.parse(issuedAtRaw);
      if (!Number.isFinite(issuedAt)) return null;
      return Math.max(0, event.createdAt.getTime() - issuedAt);
    })
    .filter((value): value is number => typeof value === "number");
  const p50ApprovalWait = percentile(approvalWaitMs, 50);
  const p95ApprovalWait = percentile(approvalWaitMs, 95);

  const dlpRedactedCount = dlpEvents.filter((event) => {
    const meta =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null;
    return meta && typeof meta.action === "string" && meta.action === "REDACT";
  }).length;
  const dlpBlockedCount = dlpEvents.filter((event) => {
    const meta =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null;
    return meta && typeof meta.action === "string" && meta.action === "BLOCK";
  }).length;

  const alertHints: Array<{ level: "HIGH" | "MEDIUM" | "INFO"; text: string }> = [];
  if (deadLetterRate >= 0.05) {
    alertHints.push({
      level: "HIGH",
      text: `Dead-letter rate is ${(deadLetterRate * 100).toFixed(1)}% (>= 5%). Remediation: inspect top failure codes and unblock policy/runtime causes.`
    });
  }
  if (failureRate >= 0.2) {
    alertHints.push({
      level: "MEDIUM",
      text: `Terminal failure rate is ${(failureRate * 100).toFixed(1)}% (>= 20%). Remediation: review manual-required transitions and retry policy outcomes.`
    });
  }
  if (p95TaskLatency != null && p95TaskLatency >= 120_000) {
    alertHints.push({
      level: "MEDIUM",
      text: `Task latency p95 is ${formatMs(p95TaskLatency)} (>= 2m). Remediation: inspect slow tool calls and queue pressure.`
    });
  }
  if (p95ApprovalWait != null && p95ApprovalWait >= 300_000) {
    alertHints.push({
      level: "MEDIUM",
      text: `Approval wait p95 is ${formatMs(p95ApprovalWait)} (>= 5m). Remediation: improve approval routing or reduce high-risk command bursts.`
    });
  }
  if (dlpBlockedCount > 0) {
    alertHints.push({
      level: "INFO",
      text: `DLP blocked ${dlpBlockedCount} output events in the last 7 days. Remediation: review blocked samples and adjust command/data handling.`
    });
  }

  return (
    <Shell
      title="Dashboard"
      subtitle={
        meta
          ? `${meta.title} (${meta.owner}/projects/${meta.number}) · Product=${dashboardProduct}`
          : "Board connection not configured yet"
      }
    >
      {boardError ? (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-5 text-sm text-white/80">
          <div className="font-semibold">GitHub board read failed</div>
          <div className="mt-2 font-mono text-xs text-white/70">{boardError}</div>
          <div className="mt-4 text-white/70">
            Set `WARROOM_GITHUB_TOKEN` and (optionally) `WARROOM_GITHUB_PROJECT_OWNER`,
            `WARROOM_GITHUB_PROJECT_NUMBER`.
          </div>
        </div>
      ) : (
        <>
          {localError ? (
            <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-200/10 p-5 text-sm text-amber-50">
              <div className="font-semibold">Local runtime read failed</div>
              <div className="mt-2 font-mono text-xs text-amber-100/90">{localError}</div>
              <div className="mt-3 text-amber-100/80">
                Remediation: verify local DB migrations (`cd apps/warroom && npx prisma migrate deploy`),
                then reload dashboard.
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/55">
                Total cards
              </div>
              <div className="mt-2 text-3xl font-semibold">{items.length}</div>
              <div className="mt-2 text-sm text-white/70">
                Showing up to 200 items filtered to Product={dashboardProduct}.
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/55">
                By status
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {countBy(items, "Status")
                  .slice(0, 7)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <div className="text-white/80">{k}</div>
                      <div className="font-mono text-xs text-white/70">{v}</div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/55">
                By agent
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {countBy(items, "Agent")
                  .slice(0, 7)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <div className="text-white/80">{k}</div>
                      <div className="font-mono text-xs text-white/70">{v}</div>
                    </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/55">
                Email ingress
              </div>
              <div className="mt-2 text-3xl font-semibold">{emailEvents.length}</div>
              <div className="mt-2 space-y-1 text-sm">
                {Object.entries(
                  emailEvents.reduce<Record<string, number>>((acc, event) => {
                    acc[event.status] = (acc[event.status] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <div className="text-white/80">{k}</div>
                      <div className="font-mono text-xs text-white/70">{v}</div>
                    </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="text-sm font-semibold">Tool-runtime SLOs (last 7 days)</div>
            <div className="mt-1 text-xs text-white/60">
              Execution latency, terminal outcomes, approval wait, and DLP event posture.
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="font-semibold text-white/80">Task latency</div>
                <div className="mt-1 text-white/65">
                  p50={formatMs(p50TaskLatency)} · p95={formatMs(p95TaskLatency)}
                </div>
                <div className="mt-1 text-white/50">samples={taskLatencyMs.length}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="font-semibold text-white/80">Terminal outcomes</div>
                <div className="mt-1 text-white/65">
                  done={doneCount} · dead={deadLetterCount} · manual={manualRequiredCount}
                </div>
                <div className="mt-1 text-white/50">
                  failure={(failureRate * 100).toFixed(1)}% · dead={(deadLetterRate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="font-semibold text-white/80">Approval wait</div>
                <div className="mt-1 text-white/65">
                  p50={formatMs(p50ApprovalWait)} · p95={formatMs(p95ApprovalWait)}
                </div>
                <div className="mt-1 text-white/50">samples={approvalWaitMs.length}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="font-semibold text-white/80">DLP output filter</div>
                <div className="mt-1 text-white/65">
                  redacted={dlpRedactedCount} · blocked={dlpBlockedCount}
                </div>
                <div className="mt-1 text-white/50">events={dlpEvents.length}</div>
              </div>
              <div className="md:col-span-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="font-semibold text-white/80">Alert hints</div>
                <div className="mt-2 space-y-1 text-white/65">
                  {alertHints.map((hint, idx) => (
                    <div key={`${hint.level}-${idx}`} className="rounded border border-white/10 bg-white/5 px-2 py-1">
                      <span className="font-mono text-white/80">{hint.level}</span> · {hint.text}
                    </div>
                  ))}
                  {alertHints.length === 0 ? (
                    <div className="text-white/55">
                      No threshold breaches in the current 7-day SLO window.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="text-sm font-semibold">Active Alpha context locks</div>
            <div className="mt-1 text-xs text-white/60">
              MVP rule: one active Alpha context window per Product.
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {activeAlphaLocks.map((lock) => (
                <div
                  key={lock.projectKey}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-200/10 px-1.5 py-0.5 text-emerald-100">
                      ACTIVE
                    </span>
                    <span className="font-mono text-white/85">{lock.projectName}</span>
                    <span className="text-white/60">
                      owner=@{lock.activeWindow?.ownerAgentKey || lock.activeWindow?.ownerAgentDisplayName || "unknown"}
                    </span>
                    <span className="text-white/45">
                      {lock.activeWindow?.activatedAt
                        ? new Date(lock.activeWindow.activatedAt).toLocaleString()
                        : "(activation pending)"}
                    </span>
                    {lock.activeWindow ? (
                      <span
                        className={`rounded-full border px-1.5 py-0.5 ${
                          lock.activeWindow.guardrailState === "BLOCKED"
                            ? "border-rose-300/25 bg-rose-200/10 text-rose-100"
                            : lock.activeWindow.guardrailState === "WARNING"
                            ? "border-amber-300/25 bg-amber-200/10 text-amber-100"
                            : lock.activeWindow.guardrailState === "OVERRIDE_ACTIVE"
                            ? "border-orange-300/25 bg-orange-200/10 text-orange-100"
                            : "border-cyan-300/25 bg-cyan-200/10 text-cyan-100"
                        }`}
                      >
                        {lock.activeWindow.guardrailState}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-white/55">
                    handover: {lock.continuityRef || "(none)"} · window{" "}
                    {lock.activeWindow ? lock.activeWindow.id.slice(0, 12) : "(none)"}
                  </div>
                  <div className="mt-1 text-white/50">
                    context usage: {lock.activeWindow?.contextUsagePercent ?? 0}%
                    {lock.activeWindow?.handoverPackageReadyAt
                      ? ` · package ready ${new Date(lock.activeWindow.handoverPackageReadyAt).toLocaleString()}`
                      : " · package pending"}
                  </div>
                </div>
              ))}
              {activeAlphaLocks.length === 0 ? (
                <div className="text-white/55">(no active Alpha project locks)</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="text-sm font-semibold">Orchestrator Introspection</div>
            <div className="mt-1 text-xs text-white/60">
              Active Alpha/context/tasks runtime snapshot (secret-safe).
            </div>
            {introspectionError ? (
              <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-200/10 px-3 py-2 text-xs text-rose-100">
                Introspection unavailable: {introspectionError}
              </div>
            ) : introspection ? (
              <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="font-semibold text-white/80">Lease</div>
                  <div className="mt-1 text-white/65">{introspection.lease.reason}</div>
                  <div className="mt-1 text-white/50">
                    owner={introspection.lease.ownerAgentKey ? `@${introspection.lease.ownerAgentKey}` : "(none)"} ·{" "}
                    ttl={introspection.lease.ttlMs === null ? "n/a" : `${Math.ceil(introspection.lease.ttlMs / 1000)}s`}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="font-semibold text-white/80">Context Locks</div>
                  <div className="mt-1 text-white/65">{introspection.contextLocks.reason}</div>
                  <div className="mt-1 text-white/50">
                    active={introspection.contextLocks.totalActiveLocks} · blocked=
                    {introspection.contextLocks.blockedLocks} · warning=
                    {introspection.contextLocks.warningLocks}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="font-semibold text-white/80">Task Pipeline</div>
                  <div className="mt-1 text-white/65">{introspection.tasks.reason}</div>
                  <div className="mt-1 text-white/50">
                    queued={introspection.tasks.queued} · running={introspection.tasks.running} · manual=
                    {introspection.tasks.manualRequired} · dead={introspection.tasks.deadLetter}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="font-semibold text-white/80">Fallback Events</div>
                  <div className="mt-1 text-white/65">{introspection.failures.reason}</div>
                  <div className="mt-1 text-white/50">
                    recent={introspection.failures.totalRecent} · high=
                    {introspection.failures.highSeverityRecent} · latest=
                    {introspection.failures.latestFailureClass || "(none)"}
                  </div>
                </div>
                <div className="md:col-span-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/55">
                  Generated {new Date(introspection.generatedAt).toLocaleString()} · API{" "}
                  <code>/api/orchestrator/state</code>
                  {introspection.errors.length > 0
                    ? ` · errors=${introspection.errors
                        .map((entry) => `${entry.component}:${entry.message}`)
                        .join(" | ")}`
                    : ""}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-white/55">(introspection snapshot unavailable)</div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="text-sm font-semibold">Inbound email pipeline outcomes</div>
            <div className="mt-1 text-xs text-white/60">
              External ingress boundary: only email is accepted in MVP.
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {emailEvents.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 ${
                        event.status === "ENQUEUED"
                          ? "border-emerald-300/25 bg-emerald-200/10 text-emerald-100"
                          : event.status === "BLOCKED"
                          ? "border-amber-300/25 bg-amber-200/10 text-amber-100"
                          : event.status === "DEAD_LETTER"
                          ? "border-rose-300/25 bg-rose-200/10 text-rose-100"
                          : "border-white/15 bg-white/5 text-white/70"
                      }`}
                    >
                      {event.status}
                    </span>
                    <span className="font-mono text-white/75">{event.senderEmail}</span>
                    <span className="text-white/50">
                      attempts={event.attemptCount}
                      {event.lastFailureCode ? ` · ${event.lastFailureCode}` : ""}
                    </span>
                    <span className="text-white/40">{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {emailEvents.length === 0 ? (
                <div className="text-white/55">(no inbound email events yet)</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="text-sm font-semibold">Board-runtime drift diagnostics</div>
            <div className="mt-1 text-xs text-white/60">
              Tasks blocked by drift sentinel when board state and runtime state diverge.
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {driftEvents.map((event) => {
                const metadata =
                  event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
                    ? (event.metadata as Record<string, unknown>)
                    : null;
                const issueNumber =
                  metadata && typeof metadata.issueNumber === "number"
                    ? metadata.issueNumber
                    : null;
                const boardStatus =
                  metadata && typeof metadata.boardStatus === "string"
                    ? metadata.boardStatus
                    : "(missing)";
                const driftCode =
                  metadata && typeof metadata.driftCode === "string"
                    ? metadata.driftCode
                    : "BOARD_RUNTIME_DRIFT";
                return (
                  <div
                    key={event.id}
                    className="rounded-lg border border-rose-300/20 bg-rose-200/10 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-1.5 py-0.5 text-rose-100">
                        BLOCKED
                      </span>
                      <span className="font-mono text-white/80">
                        task={event.entityId || "(unknown)"}
                      </span>
                      <span className="text-white/65">
                        issue={issueNumber ? `#${issueNumber}` : "(none)"} · boardStatus={boardStatus}
                      </span>
                      <span className="text-white/45">{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-white/60">{event.reason}</div>
                    <div className="mt-1 text-white/45">code={driftCode}</div>
                  </div>
                );
              })}
              {driftEvents.length === 0 ? (
                <div className="text-white/55">(no drift blocks recorded)</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="text-sm font-semibold">Execution provenance chain</div>
            <div className="mt-1 text-xs text-white/60">
              Approver, runtime execution, and git artifact lineage events.
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {provenanceEvents.map((event) => {
                const metadata =
                  event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
                    ? (event.metadata as Record<string, unknown>)
                    : null;
                const taskId =
                  metadata && typeof metadata.taskId === "string" ? metadata.taskId : "(unknown)";
                const approver =
                  metadata && typeof metadata.approverUserId === "string"
                    ? metadata.approverUserId
                    : "(n/a)";
                const prNumber =
                  metadata && typeof metadata.prNumber === "number"
                    ? metadata.prNumber
                    : null;
                const commitSha =
                  metadata && typeof metadata.commitSha === "string"
                    ? metadata.commitSha
                    : null;
                return (
                  <div
                    key={event.id}
                    className="rounded-lg border border-cyan-300/20 bg-cyan-200/10 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-1.5 py-0.5 text-cyan-100">
                        {event.action}
                      </span>
                      <span className="font-mono text-white/80">chain={event.entityId || "(none)"}</span>
                      <span className="text-white/65">task={taskId}</span>
                      <span className="text-white/65">approver={approver}</span>
                      {prNumber ? <span className="text-white/65">pr=#{prNumber}</span> : null}
                      {commitSha ? (
                        <span className="text-white/65">sha={commitSha.slice(0, 12)}</span>
                      ) : null}
                      <span className="text-white/45">{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-white/60">{event.reason}</div>
                  </div>
                );
              })}
              {provenanceEvents.length === 0 ? (
                <div className="text-white/55">(no provenance events recorded)</div>
              ) : null}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/12 bg-white/5">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-sm font-semibold">Latest cards</div>
                <div className="mt-1 text-xs text-white/60">
                  Click a card to view details, chat, and update fields.
                </div>
              </div>
              <Link
                href="/products"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/85 hover:bg-white/10"
              >
                Filter by product
              </Link>
            </div>
            <div className="divide-y divide-white/10">
              {items.slice(0, 30).map((it) => (
                <Link
                  key={it.issueNumber}
                  href={`/issues/${it.issueNumber}`}
                  className="block px-5 py-4 hover:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        #{it.issueNumber} {it.issueTitle}
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {it.fields["Product"] || "(no product)"} ·{" "}
                        {it.fields["Type"] || "(no type)"} ·{" "}
                        {it.fields["Priority"] || "(no priority)"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-white/65">
                      <div>{it.fields["Status"] || "(no status)"}</div>
                      <div className="mt-1">{it.fields["Agent"] || "(no agent)"}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
