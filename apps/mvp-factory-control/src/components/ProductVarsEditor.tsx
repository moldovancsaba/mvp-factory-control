"use client";

/**
 * Grouped project **vars** editor: key/value, optional formula (`${OTHER}` deps), doc tooltip/modal, usage counts.
 * Submits a JSON payload via hidden input `varsPayload` for `saveProjectConfigAction`.
 */
import { useMemo, useState } from "react";
import type { ProjectVar, ProjectVarUsageEntry } from "@/lib/settings-store";
import { buttonClassName } from "@/components/ui";

const DEFAULT_GROUP = "General";

type Row = {
  id: string;
  key: string;
  value: string;
  formula: string;
  group: string;
  doc: string;
};

function newRow(partial?: Partial<Row>): Row {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `r-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    key: partial?.key ?? "",
    value: partial?.value ?? "",
    formula: partial?.formula ?? "",
    group: partial?.group?.trim() || DEFAULT_GROUP,
    doc: partial?.doc ?? ""
  };
}

function toRows(vars: ProjectVar[]): Row[] {
  if (!vars.length) return [newRow()];
  return vars.map((v) =>
    newRow({
      key: v.key,
      value: v.value,
      formula: v.formula || "",
      group: v.group || DEFAULT_GROUP,
      doc: v.doc || ""
    })
  );
}

export function ProductVarsEditor(props: {
  initialVars: ProjectVar[];
  varUsage?: Record<string, ProjectVarUsageEntry>;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(props.initialVars));
  const [docModal, setDocModal] = useState<{ title: string; body: string } | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const g = r.group.trim() || DEFAULT_GROUP;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow(group?: string) {
    setRows((prev) => [...prev, newRow({ group: group || DEFAULT_GROUP })]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  const payload = useMemo(() => {
    return rows
      .filter((r) => r.key.trim())
      .map((r) => {
        const o: ProjectVar = { key: r.key.trim(), value: r.value };
        if (r.formula.trim()) o.formula = r.formula.trim();
        const g = r.group.trim() || DEFAULT_GROUP;
        if (g !== DEFAULT_GROUP) o.group = g;
        if (r.doc.trim()) o.doc = r.doc.trim();
        return o;
      });
  }, [rows]);

  const usage = props.varUsage || {};

  return (
    <>
      <input type="hidden" name="varsPayload" value={JSON.stringify(payload)} />
      <div className="ui-meta mb-2 text-xs text-white/55">
        Use <code className="rounded bg-white/10 px-1">{`${"${VAR}"}`}</code> in value or formula for
        dependencies. Formula overrides value when non-empty. Runtime keys (e.g.{" "}
        <code className="rounded bg-white/10 px-1">MVP_FACTORY_CONTROL_RUNTIME_MODEL</code>) still
        follow mutability rules.
      </div>
      <div className="space-y-3">
        {grouped.map(([groupName, groupRows]) => (
          <details
            key={groupName}
            open
            className="rounded-lg border border-white/10 bg-white/[0.03]"
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-white/85">
              {groupName}{" "}
              <span className="font-normal text-white/45">({groupRows.length})</span>
            </summary>
            <div className="space-y-3 border-t border-white/10 px-4 py-4">
              {groupRows.map((row) => {
                const u = usage[row.key.trim()];
                return (
                  <div
                    key={row.id}
                    className="ui-subpanel ui-stack-md rounded-md border border-white/5 p-3"
                  >
                    <div className="ui-grid-2 gap-3">
                      <label className="ui-field">
                        <span className="ui-field__label">Key</span>
                        <input
                          className="ui-input font-mono text-xs"
                          value={row.key}
                          onChange={(e) => updateRow(row.id, { key: e.target.value })}
                          placeholder="MY_SETTING"
                        />
                      </label>
                      <label className="ui-field">
                        <span className="ui-field__label">Group</span>
                        <input
                          className="ui-input text-xs"
                          value={row.group}
                          onChange={(e) => updateRow(row.id, { group: e.target.value })}
                          placeholder={DEFAULT_GROUP}
                        />
                      </label>
                    </div>
                    <label className="ui-field">
                      <span className="ui-field__label">Value</span>
                      <input
                        className="ui-input font-mono text-xs"
                        value={row.value}
                        onChange={(e) => updateRow(row.id, { value: e.target.value })}
                        placeholder="literal or base template"
                      />
                    </label>
                    <label className="ui-field">
                      <span className="ui-field__label">Formula (optional)</span>
                      <input
                        className="ui-input font-mono text-xs"
                        value={row.formula}
                        onChange={(e) => updateRow(row.id, { formula: e.target.value })}
                        placeholder={`e.g. https://\${API_HOST}/v1`}
                      />
                    </label>
                    <label className="ui-field">
                      <span className="ui-field__label">Documentation</span>
                      <div className="flex gap-2">
                        <input
                          className="ui-input flex-1 text-xs"
                          value={row.doc}
                          onChange={(e) => updateRow(row.id, { doc: e.target.value })}
                          placeholder="Short description (shown in tooltip)"
                          title={row.doc || undefined}
                        />
                        {row.doc.trim() ? (
                          <button
                            type="button"
                            className={buttonClassName("secondary")}
                            onClick={() =>
                              setDocModal({ title: row.key || "Variable", body: row.doc })
                            }
                          >
                            View
                          </button>
                        ) : null}
                      </div>
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-white/50">
                        {row.key.trim() ? (
                          <>
                            Usage: {u ? `${u.count}×` : "—"}
                            {u?.lastUsedAt ? (
                              <span className="ml-2 text-white/40">
                                last {new Date(u.lastUsedAt).toLocaleString()}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span>Save a key to track usage.</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={buttonClassName("secondary")}
                          onClick={() => addRow(row.group)}
                        >
                          Add in group
                        </button>
                        <button
                          type="button"
                          className={buttonClassName("danger")}
                          onClick={() => removeRow(row.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
      <div className="mt-3">
        <button type="button" className={buttonClassName("secondary")} onClick={() => addRow()}>
          Add variable
        </button>
      </div>

      {docModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="var-doc-title"
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border border-white/15 bg-zinc-950 p-5 shadow-xl">
            <div id="var-doc-title" className="text-sm font-semibold text-white/90">
              {docModal.title}
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-white/75">{docModal.body}</pre>
            <button
              type="button"
              className={`${buttonClassName()} mt-4`}
              onClick={() => setDocModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
