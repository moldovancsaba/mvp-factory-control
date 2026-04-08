/**
 * **Global chat** UI: thread kind GLOBAL, messages, mention input, handoff metadata rendering from message meta.
 */
//> Import bindings from a module.
import { redirect } from "next/navigation";
//> Import bindings from a module.
import { Shell } from "@/components/Shell";
//> Import bindings from a module.
import { requireSession } from "@/lib/session";
//> Import bindings from a module.
import { getOrCreateThread, listMessages } from "@/lib/chat";
//> Import bindings from a module.
import { sendGlobalMessage } from "@/app/chat/actions";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { buildMentionables } from "@/lib/mentionables";
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

//> Export declaration.
export default async function ChatPage() {
  //> Variable declaration.
  const session = await requireSession();
  //> Conditional branch.
  if (!session) redirect("/signin");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = (session.user as any).id as string | undefined;

  //> Variable declaration.
  const thread = await getOrCreateThread({
    //> Source statement or expression.
    kind: "GLOBAL",
    //> Source statement or expression.
    ref: "main",
    //> Source statement or expression.
    title: "Global",
    //> Source statement or expression.
    createdById: userId ?? null
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const messages = await listMessages(thread.id, 200);
  //> Variable declaration.
  const agents = await prisma.agent.findMany({
    //> Source statement or expression.
    where: { enabled: true, runtime: { in: ["LOCAL", "CLOUD"] } },
    //> Source statement or expression.
    orderBy: { displayName: "asc" }
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const humanNames = Array.from(
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
  );
  //> Variable declaration.
  const mentionables = buildMentionables({
    //> Source statement or expression.
    agentKeys: agents.map((a) => a.key),
    //> Source statement or expression.
    humanNames
  //> Brace or statement terminator.
  });

  //> Return a value.
  return (
    <Shell
      title="Chat"
      subtitle='Global thread. Mention agents to queue work (example: "@Agent sync on amanoba").'
    >
      <div className="ui-list-panel">
        <div className="ui-scroll max-h-[55vh] p-5">
          <div className="ui-stack-md">
            {messages.map((m) => {
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
                        className={`mt-2 ${badgeClassName(routed.manualRequired ? "warning" : "accent")}`}
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
            })}
            {messages.length === 0 ? (
              <div className="ui-empty">No messages yet.</div>
            ) : null}
          </div>
        </div>
        <div className="border-t border-white/10 p-5">
          <form action={sendGlobalMessage} className="flex gap-3">
            <MentionInput
              name="content"
              mentionables={mentionables}
              placeholder='Message (try: "@Agent sync on amanoba")'
            />
            <button
              type="submit"
              className={buttonClassName()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </Shell>
  );
//> Brace or statement terminator.
}
