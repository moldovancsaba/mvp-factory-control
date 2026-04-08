/**
 * Parses a leading `@AgentKey remainder` mention from chat or email bodies.
 *
 * Returns `none` if no `@`, `invalid` with reason for bad syntax, or `agent` with normalized key and command text.
 * Agent keys must match `^[A-Za-z0-9_-]+$`.
 */
//> Export declaration.
export type AgentMentionParseResult =
  //> Source statement or expression.
  | { kind: "none" }
  //> Source statement or expression.
  | { kind: "invalid"; reason: string; raw: string }
  //> Source statement or expression.
  | { kind: "agent"; agentKey: string; command: string };

//> Export declaration.
export function parseAgentMention(text: string): AgentMentionParseResult {
  //> Variable declaration.
  const t = text.trim();
  //> Conditional branch.
  if (!t.startsWith("@")) return { kind: "none" };

  //> Variable declaration.
  const m = /^@(\S+)(?:\s+([\s\S]+))?$/.exec(t);
  //> Conditional branch.
  if (!m) {
    //> Return a value.
    return {
      //> Source statement or expression.
      kind: "invalid",
      //> Source statement or expression.
      raw: t,
      //> Source statement or expression.
      reason: "Could not parse mention. Use @Agent <command>."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const agentKey = String(m[1] || "").trim();
  //> Conditional branch.
  if (!/^[A-Za-z0-9_-]+$/.test(agentKey)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      kind: "invalid",
      //> Source statement or expression.
      raw: t,
      //> Source statement or expression.
      reason: "Agent handle contains invalid characters."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const command = String(m[2] || "").trim();
  //> Conditional branch.
  if (!command) {
    //> Return a value.
    return {
      //> Source statement or expression.
      kind: "invalid",
      //> Source statement or expression.
      raw: t,
      //> Source statement or expression.
      reason: "Missing command after mention."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { kind: "agent", agentKey, command };
//> Brace or statement terminator.
}
