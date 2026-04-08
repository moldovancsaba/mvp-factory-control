/**
 * **Dashboard**: portfolio snapshot from GitHub project board, Prisma tasks, alpha locks, orchestrator introspection.
 *
 * Auth: `requireSession`. Project key from `MVP_FACTORY_CONTROL_DASHBOARD_PRODUCT` (default `mvp-factory-control`).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/session";
import { getProjectMeta, listProjectItems } from "@/lib/github";
import { listActiveProjectAlphaLocks } from "@/lib/alpha-context";
import { getOrchestratorIntrospectionSnapshot } from "@/lib/orchestrator-introspection";
import { prisma } from "@/lib/prisma";
import { badgeClassName, buttonClassName } from "@/components/ui";

function countBy(items: Array<{ fields: Record<string, string> }>, field: string) {
  const out: Record<string, number> = {};
  for (const it of items) {
    const v = it.fields[field] || "(unset)";
    out[v] = (out[v] || 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

export default async function DashboardPage() {
  const session = await requireSession();
  if (!session) redirect("/signin");

  const dashboardProduct = (process.env.MVP_FACTORY_CONTROL_DASHBOARD_PRODUCT || "mvp-factory-control").trim();
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
  let activeAlphaLocks: Awaited<ReturnType<typeof listActiveProjectAlphaLocks>> = [];
  let introspection: Awaited<ReturnType<typeof getOrchestratorIntrospectionSnapshot>> | null = null;
  let introspectionError: string | null = null;
  let boardError: string | null = null;
  let localError: string | null = null;

  try {
    [meta, items] = await Promise.all([
      getProjectMeta(),
      listProjectItems({ limit: 200, product: dashboardProduct })
    ]);
  } catch (e) {
    boardError = e instanceof Error ? e.message : String(e);
  }

  try {
    [emailEvents, activeAlphaLocks] = await Promise.all([
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
      listActiveProjectAlphaLocks(30)
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
        <div className="ui-panel ui-stack-md">
          <div className="ui-section-title">GitHub board read failed</div>
          <div className="ui-subpanel font-mono text-xs text-white/70">{boardError}</div>
          <div className="ui-copy">
            Set `MVP_FACTORY_CONTROL_GITHUB_TOKEN` and (optionally) `MVP_FACTORY_CONTROL_GITHUB_PROJECT_OWNER`,
            `MVP_FACTORY_CONTROL_GITHUB_PROJECT_NUMBER`.
          </div>
        </div>
      ) : (
        <div className="ui-stack-lg">
          {localError ? (
            <div className="ui-panel ui-stack-md border-amber-300/25 bg-amber-200/10 text-amber-50">
              <div className="ui-section-title text-amber-50">Local runtime read failed</div>
              <div className="ui-subpanel border-amber-300/25 bg-black/20 font-mono text-xs text-amber-100/90">{localError}</div>
              <div className="ui-copy text-amber-100/80">
                Remediation: verify local DB migrations (`cd apps/mvp-factory-control && npx prisma migrate deploy`),
                then reload dashboard.
              </div>
            </div>
          ) : null}
          <div className="ui-grid-4">
            <div className="ui-panel ui-stack-sm">
              <div className="ui-kicker">
                Total cards
              </div>
              <div className="ui-kpi-value">{items.length}</div>
              <div className="ui-copy">
                Showing up to 200 items filtered to Product={dashboardProduct}.
              </div>
            </div>
            <div className="ui-panel ui-stack-sm">
              <div className="ui-kicker">
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
            <div className="ui-panel ui-stack-sm">
              <div className="ui-kicker">
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
            <div className="ui-panel ui-stack-sm">
              <div className="ui-kicker">
                Email ingress
              </div>
              <div className="ui-kpi-value">{emailEvents.length}</div>
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

          <div className="ui-panel ui-stack-md">
            <div className="ui-section-title">Active Alpha context locks</div>
            <div className="ui-meta">
              MVP rule: one active Alpha context window per Product.
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {activeAlphaLocks.map((lock) => (
                <div
                  key={lock.projectKey}
                  className="ui-subpanel"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={badgeClassName("success")}>
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
                        className={badgeClassName(
                          lock.activeWindow.guardrailState === "BLOCKED"
                            ? "danger"
                            : lock.activeWindow.guardrailState === "WARNING"
                            ? "warning"
                            : "accent"
                        )}
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
                <div className="ui-empty">(no active Alpha project locks)</div>
              ) : null}
            </div>
          </div>

          <div className="ui-panel ui-stack-md">
            <div className="ui-section-title">Orchestrator Introspection</div>
            <div className="ui-meta">
              Active Alpha/context/tasks runtime snapshot (secret-safe).
            </div>
            {introspectionError ? (
              <div className="ui-empty border-rose-300/25 bg-rose-200/10 text-rose-100">
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
                <div className="md:col-span-4 ui-subpanel text-[11px] text-white/55">
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
              <div className="ui-empty">(introspection snapshot unavailable)</div>
            )}
          </div>

          <div className="ui-panel ui-stack-md">
            <div className="ui-section-title">Inbound email pipeline outcomes</div>
            <div className="ui-meta">
              External ingress boundary: only email is accepted in MVP.
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {emailEvents.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="ui-subpanel"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={badgeClassName(
                        event.status === "ENQUEUED"
                          ? "success"
                          : event.status === "BLOCKED"
                          ? "warning"
                          : event.status === "DEAD_LETTER"
                          ? "danger"
                          : "default"
                      )}
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
                <div className="ui-empty">(no inbound email events yet)</div>
              ) : null}
            </div>
          </div>

          <div className="ui-list-panel">
            <div className="ui-toolbar border-b border-white/10 px-5 py-4">
              <div>
                <div className="ui-section-title">Latest cards</div>
                <div className="ui-meta">
                  Click a card to view details, chat, and update fields.
                </div>
              </div>
              <Link
                href="/products"
                className={buttonClassName("secondary")}
              >
                Filter by product
              </Link>
            </div>
            <div>
              {items.slice(0, 30).map((it) => (
                <Link
                  key={it.issueNumber}
                  href={`/issues/${it.issueNumber}`}
                  className="ui-list-row"
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
        </div>
      )}
    </Shell>
  );
}
