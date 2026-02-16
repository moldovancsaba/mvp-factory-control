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
