/**
 * Resolves project **vars** with `${VAR}` dependency substitution and optional per-key **formula** templates.
 *
 * When `formula` is non-empty it is the template source; otherwise `value` is used. Iterates to a
 * fixpoint (handles chains); cyclic references stop progressing and may leave `${NAME}` in output.
 */
import type { ProjectVar } from "@/lib/settings-store";

const REF_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

export function extractVarRefs(template: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(REF_RE.source, "g");
  while ((m = re.exec(template)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function rawTemplate(row: ProjectVar): string {
  const f = String(row.formula || "").trim();
  if (f) return f;
  return String(row.value || "");
}

/**
 * Substitute `${KEY}` with values from `resolved`; unknown keys keep the placeholder for another pass.
 */
function substitute(template: string, resolved: Record<string, string>): string {
  return template.replace(REF_RE, (full, name: string) => {
    if (Object.prototype.hasOwnProperty.call(resolved, name)) {
      return resolved[name];
    }
    return full;
  });
}

export type ResolveProjectVarsResult = {
  resolved: Record<string, string>;
  errors: string[];
};

export function resolveProjectVars(vars: ProjectVar[]): ResolveProjectVarsResult {
  const errors: string[] = [];
  const byKey = new Map<string, string>();
  for (const v of vars) {
    const k = String(v.key || "").trim();
    if (!k) continue;
    byKey.set(k, rawTemplate(v));
  }

  const resolved: Record<string, string> = {};
  const maxPasses = Math.max(byKey.size + 8, 16);
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const [k, raw] of byKey) {
      const next = substitute(raw, resolved);
      if (resolved[k] !== next) {
        resolved[k] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const unresolvedRe = /\$\{[A-Z][A-Z0-9_]*\}/;
  for (const [k] of byKey) {
    const v = resolved[k] ?? "";
    if (unresolvedRe.test(v)) {
      errors.push(`Unresolved or cyclic references in variable "${k}"`);
    }
  }

  return { resolved, errors };
}

/** BFS dependency closure starting from seed keys (e.g. runtime keys that were applied). */
export function collectVarDependencyClosure(
  vars: ProjectVar[],
  seedKeys: string[]
): Set<string> {
  const byKey = new Map<string, ProjectVar>();
  for (const v of vars) {
    const k = String(v.key || "").trim();
    if (k) byKey.set(k, v);
  }

  const seen = new Set<string>();
  const queue = seedKeys.map((k) => k.trim()).filter(Boolean);
  for (const k of queue) seen.add(k);

  let qi = 0;
  while (qi < queue.length) {
    const k = queue[qi++];
    const row = byKey.get(k);
    if (!row) continue;
    const tmpl = rawTemplate(row);
    for (const dep of extractVarRefs(tmpl)) {
      if (!seen.has(dep)) {
        seen.add(dep);
        queue.push(dep);
      }
    }
  }
  return seen;
}
