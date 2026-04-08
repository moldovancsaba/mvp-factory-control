/**
 * Builds autocomplete **mentionables** from agent keys and human display names (slug handles, de-duplicated).
 *
 * Normalizes unicode to ASCII-ish handles for `MentionInput`. Agents win over humans on handle collision.
 */
//> Export declaration.
export type Mentionable = {
  //> Source statement or expression.
  handle: string;
  //> Source statement or expression.
  label: string;
  //> Source statement or expression.
  kind: "agent" | "human";
//> Brace or statement terminator.
};

//> Function declaration.
function normalizeHandle(input: string) {
  //> Return a value.
  return input
    //> Source statement or expression.
    .normalize("NFKD")
    //> Source statement or expression.
    .replace(/[^\w\s-]/g, "")
    //> Source statement or expression.
    .trim()
    //> Source statement or expression.
    .replace(/\s+/g, "-")
    //> Source statement or expression.
    .replace(/-+/g, "-");
//> Brace or statement terminator.
}

//> Export declaration.
export function buildMentionables(params: {
  //> Source statement or expression.
  agentKeys: string[];
  //> Source statement or expression.
  humanNames: string[];
//> Source statement or expression.
}): Mentionable[] {
  //> Variable declaration.
  const out: Mentionable[] = [];
  //> Variable declaration.
  const taken = new Set<string>();
  //> Variable declaration.
  const agentByLower = new Map<string, Mentionable>();

  //> For-loop header.
  for (const key of params.agentKeys) {
    //> Variable declaration.
    const handle = key.trim();
    //> Conditional branch.
    if (!handle) continue;
    //> Variable declaration.
    const lower = handle.toLowerCase();
    //> Variable declaration.
    const next: Mentionable = { handle, label: handle, kind: "agent" };
    //> Variable declaration.
    const existing = agentByLower.get(lower);
    //> Conditional branch.
    if (!existing) {
      //> Source statement or expression.
      agentByLower.set(lower, next);
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    // Prefer a cased variant over all-lowercase for cleaner UX.
    //> Variable declaration.
    const existingIsLower = existing.handle === existing.handle.toLowerCase();
    //> Variable declaration.
    const nextIsLower = next.handle === next.handle.toLowerCase();
    //> Conditional branch.
    if (existingIsLower && !nextIsLower) {
      //> Source statement or expression.
      agentByLower.set(lower, next);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> For-loop header.
  for (const mentionable of agentByLower.values()) {
    //> Variable declaration.
    const lower = mentionable.handle.toLowerCase();
    //> Conditional branch.
    if (taken.has(lower)) continue;
    //> Source statement or expression.
    taken.add(lower);
    //> Source statement or expression.
    out.push(mentionable);
  //> Brace or statement terminator.
  }

  //> For-loop header.
  for (const name of params.humanNames) {
    //> Conditional branch.
    if (!name) continue;
    //> Variable declaration.
    let base = normalizeHandle(name);
    //> Conditional branch.
    if (!base) continue;
    //> Variable declaration.
    let handle = base;
    //> Variable declaration.
    let i = 2;
    //> While-loop header.
    while (taken.has(handle.toLowerCase())) {
      //> Source statement or expression.
      handle = `${base}-${i}`;
      //> Source statement or expression.
      i += 1;
    //> Brace or statement terminator.
    }
    //> Source statement or expression.
    taken.add(handle.toLowerCase());
    //> Source statement or expression.
    out.push({ handle, label: name, kind: "human" });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return out;
//> Brace or statement terminator.
}
