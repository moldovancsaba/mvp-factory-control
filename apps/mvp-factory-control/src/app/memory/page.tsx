import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { badgeClassName, buttonClassName } from "@/components/ui";
import { requireSession } from "@/lib/session";
import {
  listMemoryAppInstances,
  listMemoryUserProfiles,
  listRecentMemoryRecords,
  retrieveMemoryContext
} from "@/lib/memory-platform";
import {
  createMemoryRecordAction,
  provisionMemoryAppInstanceAction,
  provisionMemoryUserProfileAction
} from "@/app/memory/actions";

export default async function MemoryPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (!session) redirect("/signin");

  const searchParams = (await props.searchParams) ?? {};
  const query = typeof searchParams.query === "string" ? searchParams.query : "";
  const selectedApp = typeof searchParams.app === "string" ? searchParams.app : "";
  const includeShared = searchParams.includeShared === "true";

  const [apps, profiles, recentRecords] = await Promise.all([
    listMemoryAppInstances(),
    listMemoryUserProfiles(),
    listRecentMemoryRecords({ limit: 12 })
  ]);

  const effectiveProfileKey =
    (profiles.find((profile) => profile.userId === (session.user as { id?: string }).id)?.key ?? profiles[0]?.key) || "";

  const retrieval =
    query || selectedApp || effectiveProfileKey ?
      await retrieveMemoryContext({
        query,
        appKey: selectedApp || null,
        userProfileKey: effectiveProfileKey || null,
        includeShared,
        limit: 8
      }) :
      null;

  return (
    <Shell
      title="Memory"
      subtitle="Scoped AI memory for apps, users, overlays, and shared collaboration."
    >
      <div className="ui-stack-lg">
        <div className="ui-grid-2">
          <div className="ui-panel ui-stack-md">
            <div className="ui-section-title">Provision app memory scope</div>
            <form action={provisionMemoryAppInstanceAction} className="grid gap-3">
              <label className="ui-field">
                <span className="ui-field__label">App key</span>
                <input name="appKey" placeholder="checklist" className="ui-input" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Display name</span>
                <input name="appDisplayName" placeholder="Checklist" className="ui-input" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Description</span>
                <input name="appDescription" placeholder="Local AI support for Checklist" className="ui-input" />
              </label>
              <div>
                <button type="submit" className={buttonClassName()}>
                  Save app instance
                </button>
              </div>
            </form>
          </div>

          <div className="ui-panel ui-stack-md">
            <div className="ui-section-title">Provision user memory profile</div>
            <form action={provisionMemoryUserProfileAction} className="grid gap-3">
              <label className="ui-field">
                <span className="ui-field__label">Profile key</span>
                <input name="userProfileKey" placeholder="csaba" className="ui-input" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Display name</span>
                <input name="userProfileDisplayName" placeholder="Csaba" className="ui-input" />
              </label>
              <div>
                <button type="submit" className={buttonClassName()}>
                  Save user profile
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="ui-panel ui-stack-md">
          <div className="ui-section-title">Create memory record</div>
          <form action={createMemoryRecordAction} className="grid gap-3">
            <div className="ui-grid-2">
              <label className="ui-field">
                <span className="ui-field__label">Scope</span>
                <select name="scope" defaultValue="APP" className="ui-input">
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="APP">APP</option>
                  <option value="USER">USER</option>
                  <option value="APP_USER">APP_USER</option>
                  <option value="SHARED">SHARED</option>
                </select>
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Lifecycle</span>
                <select name="lifecycleState" defaultValue="DRAFT" className="ui-input">
                  <option value="DRAFT">DRAFT</option>
                  <option value="SYSTEM_PROPOSED">SYSTEM_PROPOSED</option>
                  <option value="HUMAN_APPROVED">HUMAN_APPROVED</option>
                </select>
              </label>
            </div>
            <div className="ui-grid-2">
              <label className="ui-field">
                <span className="ui-field__label">App key</span>
                <input name="appKey" list="memory-app-keys" defaultValue={selectedApp} className="ui-input" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">User profile key</span>
                <input name="userProfileKey" list="memory-profile-keys" defaultValue={effectiveProfileKey} className="ui-input" />
              </label>
            </div>
            <div className="ui-grid-2">
              <label className="ui-field">
                <span className="ui-field__label">Record type</span>
                <input name="recordType" defaultValue="note" className="ui-input" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Shared channel key</span>
                <input name="sharedChannelKey" placeholder="portfolio-insights" className="ui-input" />
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Title</span>
              <input name="title" placeholder="Checklist async sync principle" className="ui-input" />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Summary</span>
              <input name="summary" placeholder="Hosted app and local worker coordinate through shared DB state." className="ui-input" />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Content</span>
              <textarea
                name="content"
                rows={6}
                className="ui-textarea"
                placeholder="Durable memory content goes here."
              />
            </label>
            <div className="ui-grid-2">
              <label className="ui-field">
                <span className="ui-field__label">Keywords</span>
                <textarea
                  name="keywords"
                  rows={3}
                  className="ui-textarea"
                  placeholder="checklist, async, database"
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Confidence</span>
                <input name="confidence" type="number" min="0" max="1" step="0.01" defaultValue="0.8" className="ui-input" />
              </label>
            </div>
            <div className="ui-grid-2">
              <label className="ui-field">
                <span className="ui-field__label">Source kind</span>
                <select name="sourceKind" defaultValue="MANUAL" className="ui-input">
                  <option value="">(none)</option>
                  <option value="MANUAL">MANUAL</option>
                  <option value="AGENT_SESSION">AGENT_SESSION</option>
                  <option value="SYSTEM_SUMMARY">SYSTEM_SUMMARY</option>
                  <option value="IMPORT">IMPORT</option>
                  <option value="POLICY">POLICY</option>
                  <option value="HANDOFF">HANDOFF</option>
                </select>
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Source ref</span>
                <input name="sourceRef" placeholder="issue-727" className="ui-input" />
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Source title</span>
              <input name="sourceTitle" placeholder="Memory architecture implementation" className="ui-input" />
            </label>
            <div>
              <button type="submit" className={buttonClassName("success")}>
                Create memory record
              </button>
            </div>
          </form>
          <datalist id="memory-app-keys">
            {apps.map((app) => (
              <option key={app.id} value={app.key} />
            ))}
          </datalist>
          <datalist id="memory-profile-keys">
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.key} />
            ))}
          </datalist>
        </div>

        <div className="ui-grid-2">
          <div className="ui-panel ui-stack-md">
            <div className="ui-section-title">Retrieval explorer</div>
            <form action="/memory" className="grid gap-3">
              <label className="ui-field">
                <span className="ui-field__label">Query</span>
                <input name="query" defaultValue={query} placeholder="async checklist sync" className="ui-input" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">App key</span>
                <input name="app" defaultValue={selectedApp} list="memory-app-keys" className="ui-input" />
              </label>
              <label className="flex items-center gap-2 text-sm text-white/75">
                <input type="checkbox" name="includeShared" value="true" defaultChecked={includeShared} />
                Include shared memory
              </label>
              <div>
                <button type="submit" className={buttonClassName("secondary")}>
                  Run retrieval
                </button>
              </div>
            </form>

            {retrieval ? (
              <div className="ui-stack-sm">
                <div className="ui-meta">
                  Precedence: {retrieval.precedence.join(" → ")}
                </div>
                {retrieval.items.length ? (
                  retrieval.items.map((item) => (
                    <div key={item.id} className="ui-subpanel ui-stack-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-white/90">
                          {item.title || item.recordType}
                        </div>
                        <span className={badgeClassName(item.scope === "APP_USER" ? "accent" : item.scope === "SHARED" ? "warning" : "default")}>
                          {item.scope}
                        </span>
                      </div>
                      <div className="ui-meta">
                        score {item.score} · {item.lifecycleState} · {item.appKey || "no-app"} · {item.userProfileKey || "no-user"}
                      </div>
                      <div className="text-sm text-white/80">
                        {item.summary || item.content}
                      </div>
                      <div className="ui-meta">Reasons: {item.reasons.join(", ")}</div>
                    </div>
                  ))
                ) : (
                  <div className="ui-meta">No records matched this retrieval request yet.</div>
                )}
              </div>
            ) : (
              <div className="ui-meta">Run a query to inspect scoped retrieval behavior.</div>
            )}
          </div>

          <div className="ui-panel ui-stack-md">
            <div className="ui-section-title">Recent memory records</div>
            {recentRecords.length ? (
              <div className="ui-stack-sm">
                {recentRecords.map((record) => (
                  <div key={record.id} className="ui-subpanel ui-stack-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-white/90">
                        {record.title || record.recordType}
                      </div>
                      <span className={badgeClassName(record.lifecycleState === "HUMAN_APPROVED" ? "success" : record.lifecycleState === "SYSTEM_PROPOSED" ? "warning" : "default")}>
                        {record.lifecycleState}
                      </span>
                    </div>
                    <div className="ui-meta">
                      {record.scope} · {record.appInstance?.key || "no-app"} · {record.userProfile?.key || "no-user"} · {new Date(record.updatedAt).toLocaleString()}
                    </div>
                    <div className="text-sm text-white/80">{record.summary || record.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ui-meta">No memory records yet. Create the first one above.</div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
