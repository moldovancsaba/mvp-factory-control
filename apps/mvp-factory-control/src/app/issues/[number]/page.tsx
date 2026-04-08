/**
 * **Issue** war room: GitHub issue body, project fields, alpha context panel, chat thread, executable prompt validation.
 *
 * Dynamic segment `[number]` is the GitHub issue number in the configured repo/project.
 */
//> Import bindings from a module.
import Link from "next/link";
//> Import bindings from a module.
import { redirect } from "next/navigation";
//> Import bindings from a module.
import { Shell } from "@/components/Shell";
//> Import bindings from a module.
import { requireSession } from "@/lib/session";
//> Import bindings from a module.
import { getOrCreateThread, listMessages } from "@/lib/chat";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  getProjectAlphaLockSnapshot,
  //> Source statement or expression.
  listProjectAlphaContextAuditEvents
//> Source statement or expression.
} from "@/lib/alpha-context";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  ensureProjectItemForIssue,
  //> Source statement or expression.
  getIssueDetails,
  //> Source statement or expression.
  getItemSingleSelectValues,
  //> Source statement or expression.
  getProjectMeta,
  //> Source statement or expression.
  reconcileBoardAgentOptions,
  //> Source statement or expression.
  reconcileBoardAgentValue
//> Source statement or expression.
} from "@/lib/github";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  activateIssueAlphaContextAction,
  //> Source statement or expression.
  closeIssueAlphaContextAction,
  //> Source statement or expression.
  enqueueIssueTask,
  //> Source statement or expression.
  overrideIssueGuardrailAction,
  //> Source statement or expression.
  recordIssueHandoverPackageAction,
  //> Source statement or expression.
  sendIssueMessage,
  //> Source statement or expression.
  transferIssueAlphaContextAction,
  //> Source statement or expression.
  updateIssueFields
//> Source statement or expression.
} from "@/app/issues/[number]/actions";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { listAgentTasks } from "@/lib/tasks";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  listIssueTaskPromptPackageInvariants,
  //> Source statement or expression.
  listProjectAlphaContextPackageInvariants
//> Source statement or expression.
} from "@/lib/prompt-package-invariants";
//> Import bindings from a module.
import { buildMentionables } from "@/lib/mentionables";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  promptPackageMissingSummary,
  //> Source statement or expression.
  validateExecutablePromptPackage
//> Source statement or expression.
} from "@/lib/executable-prompt";
//> Import bindings from a module.
import { MentionInput } from "@/components/MentionInput";
//> Import bindings from a module.
import { badgeClassName, buttonClassName } from "@/components/ui";

//> Function declaration.
function asRecord(value: unknown): Record<string, unknown> | null {
  //> Conditional branch.
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  //> Return a value.
  return value as Record<string, unknown>;
//> Brace or statement terminator.
}

//> Function declaration.
function readRoutedHandoffMeta(meta: unknown): null | {
  //> Source statement or expression.
  requestedByAgent: string;
  //> Source statement or expression.
  targetAgentKey: string;
  //> Source statement or expression.
  sourceMessageId: string | null;
  //> Source statement or expression.
  manualRequired: boolean;
  //> Source statement or expression.
  reason: string | null;
//> Source statement or expression.
} {
  //> Variable declaration.
  const record = asRecord(meta);
  //> Conditional branch.
  if (
    //> Source statement or expression.
    !record ||
    //> Source statement or expression.
    (record.kind !== "agent_handoff_routed" &&
      //> Source statement or expression.
      record.kind !== "agent_handoff_manual_required")
  //> Source statement or expression.
  ) {
    //> Return a value.
    return null;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const requestedByAgent =
    //> Source statement or expression.
    typeof record.requestedByAgent === "string" ? record.requestedByAgent : null;
  //> Variable declaration.
  const targetAgentKey =
    //> Source statement or expression.
    typeof record.targetAgentKey === "string" ? record.targetAgentKey : null;
  //> Variable declaration.
  const sourceMessageId =
    //> Source statement or expression.
    typeof record.sourceMessageId === "string" ? record.sourceMessageId : null;
  //> Variable declaration.
  const reason = typeof record.reason === "string" ? record.reason : null;

  //> Conditional branch.
  if (!requestedByAgent || !targetAgentKey) return null;
  //> Return a value.
  return {
    //> Source statement or expression.
    requestedByAgent,
    //> Source statement or expression.
    targetAgentKey,
    //> Source statement or expression.
    sourceMessageId,
    //> Source statement or expression.
    manualRequired: record.kind === "agent_handoff_manual_required",
    //> Source statement or expression.
    reason
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function readTaskHandoffTrace(payload: unknown): null | {
  //> Source statement or expression.
  requestedByAgent: string;
  //> Source statement or expression.
  sourceThreadId: string;
  //> Source statement or expression.
  sourceMessageId: string;
//> Source statement or expression.
} {
  //> Variable declaration.
  const record = asRecord(payload);
  //> Conditional branch.
  if (!record || record.kind !== "agent_handoff") return null;

  //> Variable declaration.
  const requestedByAgent =
    //> Source statement or expression.
    typeof record.requestedByAgent === "string" ? record.requestedByAgent : null;
  //> Variable declaration.
  const sourceThreadId =
    //> Source statement or expression.
    typeof record.sourceThreadId === "string" ? record.sourceThreadId : null;
  //> Variable declaration.
  const sourceMessageId =
    //> Source statement or expression.
    typeof record.sourceMessageId === "string" ? record.sourceMessageId : null;

  //> Conditional branch.
  if (!requestedByAgent || !sourceThreadId || !sourceMessageId) return null;
  //> Return a value.
  return { requestedByAgent, sourceThreadId, sourceMessageId };
//> Brace or statement terminator.
}

//> Export declaration.
export default async function IssuePage(props: {
  //> Source statement or expression.
  params: Promise<{ number: string }>;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const session = await requireSession();
  //> Conditional branch.
  if (!session) redirect("/signin");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;

  //> Variable declaration.
  const { number } = await props.params;
  //> Variable declaration.
  const issueNumber = Number(number);
  //> Conditional branch.
  if (!Number.isFinite(issueNumber)) redirect("/dashboard");

  //> Variable declaration.
  const [meta, issue] = await Promise.all([
    //> Source statement or expression.
    getProjectMeta(),
    //> Source statement or expression.
    getIssueDetails({ issueNumber })
  //> Delimiter or separator.
  ]);

  //> Variable declaration.
  const { itemId } = await ensureProjectItemForIssue({ issueNumber });
  //> Variable declaration.
  const current = await getItemSingleSelectValues({ itemId });

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "ISSUE",
    //> Source statement or expression.
    ref: String(issueNumber),
    //> Source statement or expression.
    title: `Issue #${issueNumber}`,
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const messages = await listMessages(thread.id, 200);
  //> Variable declaration.
  const promptValidation = validateExecutablePromptPackage(issue.body || "");

  //> Variable declaration.
  const statusOpts = meta.fields.find((f) => f.name === "Status")?.options ?? [];
  //> Variable declaration.
  const boardAgentOpts = meta.fields.find((f) => f.name === "Agent")?.options ?? [];
  //> Variable declaration.
  const priOpts = meta.fields.find((f) => f.name === "Priority")?.options ?? [];
  //> Variable declaration.
  const dodOpts = meta.fields.find((f) => f.name === "DoD")?.options ?? [];

  //> Variable declaration.
  const agents = await prisma.agent.findMany({ orderBy: { displayName: "asc" } });
  //> Variable declaration.
  const runtimeAgents = agents.filter((a) => a.runtime !== "MANUAL");
  //> Variable declaration.
  const boardAgentResolution = reconcileBoardAgentValue({
    //> Source statement or expression.
    boardAgentValue: current["Agent"] || null,
    //> Source statement or expression.
    dbAgents: runtimeAgents.map((a) => ({
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
  const boardAgentReconciliation = reconcileBoardAgentOptions({
    //> Source statement or expression.
    boardAgentOptions: boardAgentOpts.map((o) => o.name),
    //> Source statement or expression.
    dbAgents: runtimeAgents.map((a) => ({
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
  const mentionables = buildMentionables({
    //> Source statement or expression.
    agentKeys: agents
      //> Source statement or expression.
      .filter((a) => a.enabled && a.runtime !== "MANUAL")
      //> Source statement or expression.
      .map((a) => a.key),
    //> Source statement or expression.
    humanNames: Array.from(
      //> Source statement or expression.
      new Set(
        //> Source statement or expression.
        messages
          //> Source statement or expression.
          .filter((m) => m.authorType === "HUMAN")
          //> Source statement or expression.
          .map((m) => m.user?.name || "")
          //> Source statement or expression.
          .concat(session.user?.name ? [session.user.name] : [])
          //> Source statement or expression.
          .filter(Boolean)
      //> Delimiter or separator.
      )
    //> Delimiter or separator.
    )
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const activeAgentForTasks = boardAgentResolution.mappedAgentKey;
  //> Variable declaration.
  const alphaAgents = runtimeAgents.filter((a) => a.controlRole === "ALPHA" && a.enabled);
  //> Variable declaration.
  const currentProjectName = String(current["Product"] || "").trim();
  //> Variable declaration.
  const alphaLockSnapshot = currentProjectName
    //> Source statement or expression.
    ? await getProjectAlphaLockSnapshot(currentProjectName)
    //> Source statement or expression.
    : null;
  //> Variable declaration.
  const alphaLockAudits = currentProjectName
    //> Source statement or expression.
    ? await listProjectAlphaContextAuditEvents({
        //> Source statement or expression.
        projectName: currentProjectName,
        //> Source statement or expression.
        limit: 10
      //> Delimiter or separator.
      })
    //> Source statement or expression.
    : [];
  //> Variable declaration.
  const tasks = activeAgentForTasks
    //> Source statement or expression.
    ? await listAgentTasks({ agentKey: activeAgentForTasks, limit: 20 })
    //> Source statement or expression.
    : [];
  //> Variable declaration.
  const taskPromptInvariants = await listIssueTaskPromptPackageInvariants({
    //> Source statement or expression.
    issueNumber,
    //> Source statement or expression.
    limit: 12
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const alphaContextPackageInvariants = currentProjectName
    //> Source statement or expression.
    ? await listProjectAlphaContextPackageInvariants({
        //> Source statement or expression.
        projectName: currentProjectName,
        //> Source statement or expression.
        limit: 12
      //> Delimiter or separator.
      })
    //> Source statement or expression.
    : [];

  //> Return a value.
  return (
    <Shell
      title={`Issue #${issueNumber}`}
      subtitle={`${current["Product"] || "(no product)"} · ${current["Status"] || "(no status)"} · ${current["Agent"] || "(no agent)"}`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="ui-panel ui-stack-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white/95">
                  {issue.title}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  Updated {new Date(issue.updatedAt).toLocaleString()}
                </div>
              </div>
              <Link
                href={issue.url}
                target="_blank"
                className="ui-button ui-button--secondary"
              >
                Open on GitHub
              </Link>
            </div>
            {issue.body ? (
              <div className="mt-4 whitespace-pre-wrap text-sm text-white/85">
                {issue.body}
              </div>
            ) : (
              <div className="mt-4 text-sm text-white/70">(No description)</div>
            )}
            {!promptValidation.valid ? (
              <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
                {promptPackageMissingSummary(promptValidation)}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-200/10 px-3 py-2 text-xs text-emerald-100">
                Executable Prompt Package: valid.
              </div>
            )}
          </div>

          <div className="ui-panel ui-stack-md">
            <div className="text-sm font-semibold">Board fields</div>
            <div className="mt-1 text-xs text-white/60">
              Updates go directly to GitHub Project fields.
            </div>
            <form
              action={async (fd) => {
                "use server";
                await updateIssueFields(issueNumber, fd);
              }}
              className="mt-4 grid gap-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-xs text-white/60">Status</div>
                  <select
                    name="Status"
                    defaultValue={current["Status"] || ""}
                    className="ui-select"
                  >
                    <option value="">(no change)</option>
                    {statusOpts.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-xs text-white/60">Agent</div>
                  <select
                    name="Agent"
                    defaultValue={boardAgentResolution.mappedAgentKey || ""}
                    className="ui-select"
                  >
                    <option value="">(no change)</option>
                    {runtimeAgents.map((a) => (
                      <option key={a.id} value={a.key}>
                        {a.displayName || a.key}
                        {a.enabled ? "" : " (disabled)"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 text-xs text-white/60">Priority</div>
                  <select
                    name="Priority"
                    defaultValue={current["Priority"] || ""}
                    className="ui-select"
                  >
                    <option value="">(no change)</option>
                    {priOpts.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-xs text-white/60">DoD</div>
                  <select
                    name="DoD"
                    defaultValue={current["DoD"] || ""}
                    className="ui-select"
                  >
                    <option value="">(no change)</option>
                    {dodOpts.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="mt-2 ui-button"
              >
                Update fields
              </button>
            </form>
            <div className="mt-4 text-xs text-white/60">
              Current: Status={current["Status"] || "-"}, Agent=
              {current["Agent"] || "-"}, Priority={current["Priority"] || "-"}, DoD=
              {current["DoD"] || "-"}
            </div>
            {boardAgentResolution.status === "UNMAPPED" ? (
              <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
                Board Agent value <code>{boardAgentResolution.rawValue}</code> is not mapped to any DB runtime
                agent. Select a runtime agent and update fields to reconcile.
              </div>
            ) : boardAgentResolution.status === "MAPPED" &&
              boardAgentResolution.rawValue &&
              boardAgentResolution.rawValue !== boardAgentResolution.mappedAgentKey ? (
              <div className="mt-2 rounded-xl border border-cyan-300/25 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-100">
                Board Agent <code>{boardAgentResolution.rawValue}</code> maps to canonical runtime key{" "}
                <code>{boardAgentResolution.mappedAgentKey}</code>.
              </div>
            ) : null}
            <div className="mt-2 text-xs text-white/55">
              Agent option integrity: mapped={boardAgentReconciliation.mappedCount}, unmapped=
              {boardAgentReconciliation.unmappedCount}.
            </div>
          </div>

          <div className="ui-panel ui-stack-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Alpha context lock (MVP)</div>
              {alphaLockSnapshot?.activeWindow ? (
                <span className={badgeClassName("success")}>
                  ACTIVE
                </span>
              ) : (
                <span className={badgeClassName()}>
                  UNLOCKED
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-white/60">
              One active Alpha context window per Product is allowed.
            </div>

            {!currentProjectName ? (
              <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
                Product is not set on this issue, so per-project Alpha context lock cannot be managed yet.
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/75">
                  <div>
                    Product: <span className="font-mono">{currentProjectName}</span>
                  </div>
                  <div className="mt-1 text-white/60">
                    Active owner:{" "}
                    {alphaLockSnapshot?.activeWindow
                      ? `@${alphaLockSnapshot.activeWindow.ownerAgentKey}`
                      : "(none)"}
                  </div>
                  <div className="mt-1 text-white/60">
                    Window id:{" "}
                    {alphaLockSnapshot?.activeWindow
                      ? alphaLockSnapshot.activeWindow.id.slice(0, 12)
                      : "(none)"}
                  </div>
                  <div className="mt-1 text-white/60">
                    Activated:{" "}
                    {alphaLockSnapshot?.activeWindow?.activatedAt
                      ? new Date(alphaLockSnapshot.activeWindow.activatedAt).toLocaleString()
                      : "(none)"}
                  </div>
                  <div className="mt-1 text-white/60">
                    Continuity ref: {alphaLockSnapshot?.continuityRef || "(none)"}
                  </div>
                  <div className="mt-1 text-white/60">
                    Context usage:{" "}
                    {alphaLockSnapshot?.activeWindow
                      ? `${alphaLockSnapshot.activeWindow.contextUsagePercent}%`
                      : "0%"}
                  </div>
                  <div className="mt-1 text-white/60">
                    Guardrail state: {alphaLockSnapshot?.activeWindow?.guardrailState || "NO_ACTIVE_LOCK"}
                  </div>
                  <div className="mt-1 text-white/60">
                    Package ready:{" "}
                    {alphaLockSnapshot?.activeWindow?.handoverPackageReadyAt
                      ? new Date(alphaLockSnapshot.activeWindow.handoverPackageReadyAt).toLocaleString()
                      : "(not recorded)"}
                  </div>
                </div>

                {alphaLockSnapshot?.activeWindow?.guardrailState === "WARNING" ? (
                  <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
                    Context usage is approaching threshold. Prepare handover package before crossing 70%.
                  </div>
                ) : null}
                {alphaLockSnapshot?.activeWindow?.guardrailState === "BLOCKED" ? (
                  <div className="mt-2 rounded-xl border border-rose-300/25 bg-rose-200/10 px-3 py-2 text-xs text-rose-100">
                    Scope expansion is blocked until both handover package ref and continuation prompt ref are recorded.
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3">
                  {alphaAgents.length === 0 ? (
                    <div className="rounded-xl border border-amber-300/25 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
                      No enabled ALPHA agents are available. Configure one on `/agents` before activating or
                      transferring context locks.
                    </div>
                  ) : null}

                  <form
                    action={async (fd) => {
                      "use server";
                      await activateIssueAlphaContextAction(issueNumber, fd);
                    }}
                    className="ui-subpanel ui-stack-md"
                  >
                    <div className="text-xs font-semibold text-white/80">
                      Activate context lock
                    </div>
                    <input type="hidden" name="projectName" value={currentProjectName} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-white/70">
                        Alpha owner
                        <select
                          name="ownerAgentKey"
                          className="mt-1 ui-input"
                          defaultValue={alphaAgents[0]?.key || ""}
                        >
                          {alphaAgents.length === 0 ? (
                            <option value="">(no enabled ALPHA agents)</option>
                          ) : null}
                          {alphaAgents.map((agent) => (
                            <option key={agent.id} value={agent.key}>
                              {agent.displayName || agent.key}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-white/70">
                        Handover reference (optional)
                        <input
                          type="text"
                          name="activationHandoverRef"
                          placeholder="docs/INTERNAL_CONTROL_APP.md#..."
                          className="mt-1 ui-input"
                        />
                      </label>
                    </div>
                    <label className="mt-2 block text-xs text-white/70">
                      Continuity note (optional)
                      <input
                        type="text"
                        name="continuityNote"
                        placeholder="operator handover note"
                        className="mt-1 ui-input"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={alphaAgents.length === 0}
                      className={buttonClassName("secondary") + " min-h-0 px-3 py-1.5 text-xs"}
                    >
                      Activate
                    </button>
                  </form>

                  <form
                    action={async (fd) => {
                      "use server";
                      await transferIssueAlphaContextAction(issueNumber, fd);
                    }}
                    className="ui-subpanel ui-stack-md"
                  >
                    <div className="text-xs font-semibold text-white/80">
                      Transfer active context lock
                    </div>
                    <input type="hidden" name="projectName" value={currentProjectName} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-white/70">
                        Successor Alpha
                        <select
                          name="toAgentKey"
                          className="mt-1 ui-input"
                          defaultValue={alphaAgents[0]?.key || ""}
                        >
                          {alphaAgents.length === 0 ? (
                            <option value="">(no enabled ALPHA agents)</option>
                          ) : null}
                          {alphaAgents.map((agent) => (
                            <option key={agent.id} value={agent.key}>
                              {agent.displayName || agent.key}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-white/70">
                        Handover reference
                        <input
                          type="text"
                          name="handoverRef"
                          required
                          placeholder="docs/INTERNAL_CONTROL_APP.md#product-relationship"
                          className="mt-1 ui-input"
                        />
                      </label>
                    </div>
                    <label className="mt-2 block text-xs text-white/70">
                      Continuity note (optional)
                      <input
                        type="text"
                        name="continuityNote"
                        placeholder="what changed before transfer"
                        className="mt-1 ui-input"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={alphaAgents.length === 0}
                      className={buttonClassName("secondary") + " min-h-0 px-3 py-1.5 text-xs"}
                    >
                      Transfer
                    </button>
                  </form>

                  <form
                    action={async (fd) => {
                      "use server";
                      await closeIssueAlphaContextAction(issueNumber, fd);
                    }}
                    className="ui-subpanel ui-stack-md"
                  >
                    <div className="text-xs font-semibold text-white/80">
                      Close active context lock
                    </div>
                    <input type="hidden" name="projectName" value={currentProjectName} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-white/70">
                        Handover reference
                        <input
                          type="text"
                          name="handoverRef"
                          required
                          placeholder="docs/PROJECT_MANAGEMENT.md#evidence-contract"
                          className="mt-1 ui-input"
                        />
                      </label>
                      <label className="text-xs text-white/70">
                        Close reason (optional)
                        <input
                          type="text"
                          name="closeReason"
                          placeholder="context complete / paused"
                          className="mt-1 ui-input"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className={buttonClassName("secondary") + " min-h-0 px-3 py-1.5 text-xs"}
                    >
                      Close lock
                    </button>
                  </form>

                  <form
                    action={async (fd) => {
                      "use server";
                      await recordIssueHandoverPackageAction(issueNumber, fd);
                    }}
                    className="ui-subpanel ui-stack-md"
                  >
                    <div className="text-xs font-semibold text-white/80">
                      Record handover package (guardrail gate)
                    </div>
                    <input type="hidden" name="projectName" value={currentProjectName} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-white/70">
                        Handover package ref
                        <input
                          type="text"
                          name="handoverPackageRef"
                          required
                          placeholder="docs/INTERNAL_CONTROL_APP.md#related-docs"
                          className="mt-1 ui-input"
                        />
                      </label>
                      <label className="text-xs text-white/70">
                        Continuation prompt ref
                        <input
                          type="text"
                          name="continuationPromptRef"
                          required
                          placeholder="docs/WIKI.md#operating-system"
                          className="mt-1 ui-input"
                        />
                      </label>
                    </div>
                    <label className="mt-2 block text-xs text-white/70">
                      Note (optional)
                      <input
                        type="text"
                        name="handoverNote"
                        placeholder="summary of continuation package readiness"
                        className="mt-1 ui-input"
                      />
                    </label>
                    <button
                      type="submit"
                      className={buttonClassName("secondary") + " min-h-0 px-3 py-1.5 text-xs"}
                    >
                      Record package
                    </button>
                  </form>

                  <form
                    action={async (fd) => {
                      "use server";
                      await overrideIssueGuardrailAction(issueNumber, fd);
                    }}
                    className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3"
                  >
                    <div className="text-xs font-semibold text-amber-100">
                      Guardrail override (explicit + audited)
                    </div>
                    <input type="hidden" name="projectName" value={currentProjectName} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-amber-100/80">
                        Override reason
                        <input
                          type="text"
                          name="overrideReason"
                          required
                          placeholder="why temporary bypass is required"
                          className="mt-1 w-full rounded-lg border border-amber-300/25 bg-black/20 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-amber-300/45"
                        />
                      </label>
                      <label className="text-xs text-amber-100/80">
                        Duration (minutes)
                        <input
                          type="number"
                          name="durationMinutes"
                          min={5}
                          max={240}
                          defaultValue={30}
                          className="mt-1 w-full rounded-lg border border-amber-300/25 bg-black/20 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-amber-300/45"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="mt-3 rounded-lg border border-amber-300/35 bg-amber-300/15 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/20"
                    >
                      Set override
                    </button>
                  </form>
                </div>

                <div className="mt-3 text-xs text-white/65">Recent context lock events</div>
                <div className="mt-2 space-y-1.5">
                  {alphaLockAudits.map((event) => (
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
                        <span className="font-mono text-white/75">{event.action}</span>
                        <span className="text-white/45">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-white/65">{event.reason}</div>
                    </div>
                  ))}
                  {alphaLockAudits.length === 0 ? (
                    <div className="text-[11px] text-white/55">(no context lock events yet)</div>
                  ) : null}
                </div>

                <div className="mt-4 text-xs text-white/65">
                  Prompt/package lineage snapshots
                </div>
                <div className="mt-2 space-y-1.5">
                  {alphaContextPackageInvariants.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[11px]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={badgeClassName("accent")}>
                          {snapshot.snapshotKind}
                        </span>
                        <span className="font-mono text-white/60">{snapshot.windowId.slice(0, 8)}</span>
                        <span className="text-white/45">
                          {new Date(snapshot.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-white/65">
                        hash {snapshot.snapshotHash.slice(0, 12)}
                        {snapshot.predecessorSnapshotId
                          ? ` · prev ${snapshot.predecessorSnapshotId.slice(0, 8)}`
                          : " · root"}
                        {snapshot.handoverPackageRef
                          ? ` · package ${snapshot.handoverPackageRef}`
                          : ""}
                      </div>
                    </div>
                  ))}
                  {alphaContextPackageInvariants.length === 0 ? (
                    <div className="text-[11px] text-white/55">(no context package snapshots yet)</div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ui-list-panel">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-sm font-semibold">Issue thread</div>
            <div className="mt-1 text-xs text-white/60">
              Stored in Postgres. This is where agents will coordinate.
            </div>
          </div>
          <div className="ui-scroll max-h-[55vh] p-5">
            <div className="ui-stack-md">
              {messages.map((m) => (
                (() => {
                  const routed = readRoutedHandoffMeta(m.meta);
                  return (
                    <div key={m.id} className="ui-chat-message">
                      <div className="ui-avatar mt-1" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <div className="font-medium text-white/75">
                            {m.authorType === "HUMAN"
                              ? m.user?.name || "Human"
                              : m.authorKey || m.authorType}
                          </div>
                          <div className="font-mono">
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-white/90">
                          {m.content}
                        </div>
                        {routed ? (
                          <div
                            className={`mt-2 rounded-lg border px-2 py-1 text-xs ${
                              routed.manualRequired
                                ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
                                : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                            }`}
                          >
                            {routed.manualRequired ? "Manual-required handoff" : "Routed handoff"} @
                            {routed.requestedByAgent} -&gt; @{routed.targetAgentKey}
                            {routed.sourceMessageId
                              ? ` (src ${routed.sourceMessageId.slice(0, 8)})`
                              : ""}
                            {routed.reason ? ` - ${routed.reason}` : ""}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ))}
              {messages.length === 0 ? (
                <div className="ui-empty">
                  No messages yet. Use this thread as the canonical place for task coordination.
                </div>
              ) : null}
            </div>
          </div>
          <div className="border-t border-white/10 p-5">
            <form
              action={async (fd) => {
                "use server";
                await sendIssueMessage(issueNumber, fd);
              }}
              className="flex gap-3"
            >
              <MentionInput
                name="content"
                mentionables={mentionables}
                placeholder='Message (try: "@Agent take this once Status=Ready")'
              />
              <button
                type="submit"
                className="ui-button"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        <div className="ui-list-panel">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-sm font-semibold">Enqueue work</div>
            <div className="mt-1 text-xs text-white/60">
              This creates a task in the War Room queue. Execution workers come next.
            </div>
          </div>
          <div className="p-5">
            <form
              action={async (fd) => {
                "use server";
                await enqueueIssueTask(issueNumber, fd);
              }}
              className="grid gap-3"
            >
              <label className="text-sm">
                <div className="mb-1 text-xs text-white/60">Agent</div>
                <select
                  name="agentKey"
                  defaultValue={boardAgentResolution.mappedAgentKey || ""}
                  className="ui-select"
                >
                  <option value="">Select agent</option>
                  {runtimeAgents.map((a) => (
                    <option key={a.id} value={a.key}>
                      {a.displayName || a.key} {a.enabled ? "" : "(disabled)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-xs text-white/60">Task title</div>
                <input
                  name="title"
                  placeholder="e.g. Implement the fix and open PR"
                  className="ui-input"
                />
              </label>
              <button
                type="submit"
                className="ui-button"
              >
                Enqueue
              </button>
            </form>

            {activeAgentForTasks ? (
              <div className="mt-6">
                <div className="text-sm font-semibold">
                  Recent tasks for {activeAgentForTasks}
                </div>
                <div className="mt-3 space-y-2">
                  {tasks.map((t) => (
                    (() => {
                      const handoff = readTaskHandoffTrace(t.payload);
                      return (
                        <div
                          key={t.id}
                          className="rounded-xl border border-white/10 bg-black/15 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-white/90">{t.title}</div>
                            <div className={badgeClassName()}>
                              {t.status}
                            </div>
                          </div>
                          {handoff ? (
                            <div className="mt-1 text-xs text-cyan-100/90">
                              Handoff from @{handoff.requestedByAgent} (src{" "}
                              {handoff.sourceMessageId.slice(0, 8)})
                            </div>
                          ) : null}
                          {t.error ? (
                            <div className="mt-1 text-xs text-amber-100/90">{t.error}</div>
                          ) : null}
                          <div className="mt-1 font-mono text-[11px] text-white/55">
                            {new Date(t.createdAt).toLocaleString()}
                          </div>
                        </div>
                      );
                    })()
                  ))}
                  {tasks.length === 0 ? (
                    <div className="text-sm text-white/70">
                      No queued tasks for this agent yet.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : boardAgentResolution.status === "UNMAPPED" ? (
              <div className="mt-4 text-sm text-amber-100/90">
                Task history unavailable: board Agent <code>{boardAgentResolution.rawValue}</code> is unmapped.
              </div>
            ) : (
              <div className="mt-4 text-sm text-white/70">
                Set an Agent on the card to see per-agent task history here.
              </div>
            )}

            <div className="mt-6">
              <div className="text-sm font-semibold">Task prompt/package invariants</div>
              <div className="mt-3 space-y-2">
                {taskPromptInvariants.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="rounded-xl border border-white/10 bg-black/15 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white/90">{snapshot.promptText}</div>
                      <div className={badgeClassName("accent")}>
                        {snapshot.sourceKind}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      task {snapshot.taskId.slice(0, 8)} · hash {snapshot.snapshotHash.slice(0, 12)} ·{" "}
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {taskPromptInvariants.length === 0 ? (
                  <div className="text-sm text-white/70">
                    No task prompt/package invariants recorded for this issue yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
//> Brace or statement terminator.
}
