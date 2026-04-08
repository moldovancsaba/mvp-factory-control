/**
 * Parses a leading `@AgentKey remainder` mention from chat or email bodies.
 *
 * Returns `none` if no `@`, `invalid` with reason for bad syntax, or `agent` with normalized key and command text.
 * Agent keys must match `^[A-Za-z0-9_-]+$`.
 */
export type AgentMentionParseResult =
  | { kind: "none" }
  | { kind: "invalid"; reason: string; raw: string }
  | { kind: "agent"; agentKey: string; command: string };

export function parseAgentMention(text: string): AgentMentionParseResult {
  const t = text.trim();
  if (!t.startsWith("@")) return { kind: "none" };

  const m = /^@(\S+)(?:\s+([\s\S]+))?$/.exec(t);
  if (!m) {
    return {
      kind: "invalid",
      raw: t,
      reason: "Could not parse mention. Use @Agent <command>."
    };
  }

  const agentKey = String(m[1] || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(agentKey)) {
    return {
      kind: "invalid",
      raw: t,
      reason: "Agent handle contains invalid characters."
    };
  }

  const command = String(m[2] || "").trim();
  if (!command) {
    return {
      kind: "invalid",
      raw: t,
      reason: "Missing command after mention."
    };
  }

  return { kind: "agent", agentKey, command };
}
