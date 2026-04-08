/**
 * **Settings** UI: local project root path, taste rubric editor (principles, version metadata).
 */
//> Import bindings from a module.
import Link from "next/link";
//> Import bindings from a module.
import { redirect } from "next/navigation";
//> Import bindings from a module.
import { Shell } from "@/components/Shell";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  saveLocalProjectFolderAction,
  //> Source statement or expression.
  saveTasteRubricAction
//> Source statement or expression.
} from "@/app/settings/actions";
//> Import bindings from a module.
import { getActiveTasteRubricVersion, readMVPFactoryControlSettings } from "@/lib/settings-store";
//> Import bindings from a module.
import { requireSession } from "@/lib/session";
//> Import bindings from a module.
import { buttonClassName } from "@/components/ui";

//> Export declaration.
export default async function SettingsPage() {
  //> Variable declaration.
  const session = await requireSession();
  //> Conditional branch.
  if (!session) redirect("/signin");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const activeRubric = getActiveTasteRubricVersion(settings);
  //> Variable declaration.
  const defaultPrinciples = activeRubric?.principles?.join("\n") || "";

  //> Return a value.
  return (
    <Shell
      title="Settings"
      subtitle="Global War Room settings. Agent and project settings are edited in their own pages."
    >
      <div className="ui-stack-lg">
        <div className="ui-panel ui-stack-md">
          <div className="ui-section-title">Local project folder</div>
          <div className="ui-meta">
            Root folder used for local path lookups and workspace defaults.
          </div>
          <form action={saveLocalProjectFolderAction} className="mt-4 flex gap-3">
            <input
              name="localProjectFolder"
              defaultValue={settings.localProjectFolder}
              placeholder="/Users/moldovancsaba/Projects"
              className="ui-input"
            />
            <button
              type="submit"
              className={buttonClassName()}
            >
              Save
            </button>
          </form>
        </div>

        <div className="ui-panel ui-stack-md">
          <div className="ui-section-title">Taste rubric (v1, human-owned)</div>
          <div className="ui-meta">
            Versioned decision-alignment rubric. Updates are restricted to rubric owner or ADMIN.
          </div>
          <div className="ui-subpanel ui-meta">
            <div>
              Active version:{" "}
              <span className="font-mono text-white/90">
                {settings.tasteRubric?.activeVersion || "(none)"}
              </span>
            </div>
            <div className="mt-1">
              Owner:{" "}
              <span className="font-mono text-white/90">
                {activeRubric?.ownerEmail || "(none)"}
              </span>
            </div>
            <div className="mt-1 text-white/55">
              Last update:{" "}
              {activeRubric?.updatedAt
                ? new Date(activeRubric.updatedAt).toLocaleString()
                : "(none)"}
            </div>
          </div>
          <form action={saveTasteRubricAction} className="mt-4 grid gap-3">
            <div className="ui-grid-2">
              <label className="ui-field">
                <span className="ui-field__label">Version</span>
                <input
                  name="version"
                  defaultValue={activeRubric?.version || "v1"}
                  placeholder="v1"
                  className="ui-input"
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Owner email</span>
                <input
                  name="ownerEmail"
                  defaultValue={activeRubric?.ownerEmail || session.user?.email || ""}
                  placeholder="owner@example.com"
                  className="ui-input"
                />
              </label>
            </div>
            <label className="ui-field">
              <span className="ui-field__label">Summary</span>
              <input
                name="summary"
                defaultValue={activeRubric?.summary || ""}
                placeholder="One-line rubric intent"
                className="ui-input"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Principles (one per line)</span>
              <textarea
                name="principles"
                defaultValue={defaultPrinciples}
                rows={5}
                className="ui-textarea"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Change reason</span>
              <input
                name="changeReason"
                defaultValue=""
                placeholder="Why this version/update is needed"
                className="ui-input"
              />
            </label>
            <div>
              <button
                type="submit"
                className={buttonClassName()}
              >
                Save rubric version
              </button>
            </div>
          </form>
        </div>

        <div className="ui-panel ui-stack-md">
          <div className="ui-section-title">Where to edit other settings</div>
          <div className="ui-grid-2">
            <Link
              href="/agents"
              className="ui-subpanel"
            >
              <div className="text-sm font-medium text-white/90">Agent settings</div>
              <div className="mt-1 ui-meta">
                Edit per-agent URL, model, and API key env var in each agent card.
              </div>
            </Link>
            <Link
              href="/products"
              className="ui-subpanel"
            >
              <div className="text-sm font-medium text-white/90">Project settings</div>
              <div className="mt-1 ui-meta">
                Open a product page and edit project URL, GitHub, and vars.
              </div>
            </Link>
          </div>
        </div>

        <div className="ui-panel ui-stack-sm">
          <div className="ui-section-title">Storage and security</div>
          <div className="ui-meta">
            Settings are stored locally at `.mvp-factory-control/settings.json`. Keep secrets in `.env` or `.env.local`.
          </div>
        </div>
      </div>
    </Shell>
  );
//> Brace or statement terminator.
}
