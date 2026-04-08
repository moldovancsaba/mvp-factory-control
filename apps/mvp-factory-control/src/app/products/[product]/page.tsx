import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import {
  deleteProjectConfigAction,
  saveProjectConfigAction
} from "@/app/products/actions";
import { listProjectItems } from "@/lib/github";
import { readMVPFactoryControlSettings } from "@/lib/settings-store";
import { requireSession } from "@/lib/session";
import { buttonClassName } from "@/components/ui";

function varsToText(vars: Array<{ key: string; value: string }>) {
  return vars.map((v) => `${v.key}=${v.value}`).join("\n");
}

export default async function ProductPage(props: {
  params: Promise<{ product: string }>;
}) {
  const session = await requireSession();
  if (!session) redirect("/signin");

  const { product } = await props.params;
  const decoded = decodeURIComponent(product);
  const [items, settings] = await Promise.all([
    listProjectItems({ product: decoded, limit: 200 }),
    readMVPFactoryControlSettings()
  ]);
  const config =
    settings.projects.find((p) => p.projectName.toLowerCase() === decoded.toLowerCase()) ||
    null;

  return (
    <Shell
      title={`Product: ${decoded}`}
      subtitle={`Cards from the board filtered by Product = ${decoded}`}
    >
      <div className="ui-stack-lg">
        <div className="ui-panel ui-stack-md">
          <div className="ui-section-title">Project settings</div>
          <div className="ui-meta">
            Manage metadata for this product. API keys should remain in env files.
          </div>
          <form action={saveProjectConfigAction} className="mt-4 grid gap-3">
            <input type="hidden" name="projectId" value={config?.projectId ?? ""} />
            <input type="hidden" name="projectName" value={decoded} />
            <div className="ui-meta font-mono">
              id: {config?.projectId ?? "(auto-generated on first save)"}
            </div>
            <div className="ui-grid-2">
              <label className="ui-field">
                <span className="ui-field__label">Project URL</span>
                <input
                  name="projectUrl"
                  defaultValue={config?.projectUrl ?? ""}
                  placeholder="https://amanoba.com"
                  className="ui-input"
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Project GitHub</span>
                <input
                  name="projectGithub"
                  defaultValue={config?.projectGithub ?? ""}
                  placeholder="moldovancsaba/mvp-factory-control"
                  className="ui-input"
                />
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Project vars (one `KEY=VALUE` per line)</span>
              <textarea
                name="vars"
                defaultValue={config ? varsToText(config.vars) : ""}
                rows={4}
                className="ui-textarea font-mono text-xs"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className={buttonClassName()}
              >
                Save project settings
              </button>
            </div>
          </form>
          {config ? (
            <form action={deleteProjectConfigAction} className="mt-3">
              <input type="hidden" name="projectId" value={config.projectId} />
              <input type="hidden" name="projectName" value={decoded} />
              <button
                type="submit"
                className={buttonClassName("danger")}
              >
                Delete project settings
              </button>
            </form>
          ) : null}
        </div>

        <div className="ui-list-panel">
          <div className="ui-toolbar border-b border-white/10 px-5 py-4">
            <div className="ui-copy">
              {items.length} cards (showing up to 200)
            </div>
            <Link
              href="/products"
              className={buttonClassName("secondary")}
            >
              Back to products
            </Link>
          </div>
          <div>
            {items.map((it) => (
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
                      {it.fields["Status"] || "(no status)"} ·{" "}
                      {it.fields["Type"] || "(no type)"} ·{" "}
                      {it.fields["Priority"] || "(no priority)"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-white/65">
                    <div>{it.fields["Agent"] || "(no agent)"}</div>
                    <div className="mt-1">{it.fields["DoD"] || "(no DoD)"}</div>
                  </div>
                </div>
              </Link>
            ))}
            {items.length === 0 ? (
              <div className="px-5 py-8 ui-copy">
                No cards found for this product.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Shell>
  );
}
