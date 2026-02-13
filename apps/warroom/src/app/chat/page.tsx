import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/session";
import { getOrCreateThread, listMessages } from "@/lib/chat";
import { sendGlobalMessage } from "@/app/chat/actions";
import { prisma } from "@/lib/prisma";
import { buildMentionables } from "@/lib/mentionables";
import { MentionInput } from "@/components/MentionInput";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readRoutedHandoffMeta(meta: unknown): null | {
  requestedByAgent: string;
  targetAgentKey: string;
  sourceMessageId: string | null;
  manualRequired: boolean;
  reason: string | null;
} {
  const record = asRecord(meta);
  if (
    !record ||
    (record.kind !== "agent_handoff_routed" &&
      record.kind !== "agent_handoff_manual_required")
  ) {
    return null;
  }

  const requestedByAgent =
    typeof record.requestedByAgent === "string" ? record.requestedByAgent : null;
  const targetAgentKey =
    typeof record.targetAgentKey === "string" ? record.targetAgentKey : null;
  const sourceMessageId =
    typeof record.sourceMessageId === "string" ? record.sourceMessageId : null;
  const reason = typeof record.reason === "string" ? record.reason : null;

  if (!requestedByAgent || !targetAgentKey) return null;

  return {
    requestedByAgent,
    targetAgentKey,
    sourceMessageId,
    manualRequired: record.kind === "agent_handoff_manual_required",
    reason
  };
}

export default async function ChatPage() {
  const session = await requireSession();
  if (!session) redirect("/signin");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id as string | undefined;

  const thread = await getOrCreateThread({
    kind: "GLOBAL",
    ref: "main",
    title: "Global",
    createdById: userId ?? null
  });
  const messages = await listMessages(thread.id, 200);
  const agents = await prisma.agent.findMany({
    where: { enabled: true, runtime: { in: ["LOCAL", "CLOUD"] } },
    orderBy: { displayName: "asc" }
  });
  const humanNames = Array.from(
    new Set(
      messages
        .filter((m) => m.authorType === "HUMAN")
        .map((m) => m.user?.name || "")
        .concat(session.user?.name ? [session.user.name] : [])
        .filter(Boolean)
    )
  );
  const mentionables = buildMentionables({
    agentKeys: agents.map((a) => a.key),
    humanNames
  });

  return (
    <Shell
      title="Chat"
      subtitle='Global thread. Mention agents to queue work (example: "@Agent sync on amanoba").'
    >
      <div className="rounded-2xl border border-white/12 bg-white/5">
        <div className="max-h-[55vh] overflow-auto p-5">
          <div className="space-y-4">
            {messages.map((m) => {
              const routed = readRoutedHandoffMeta(m.meta);
              return (
                <div key={m.id} className="flex gap-3">
                  <div className="mt-1 h-8 w-8 flex-none rounded-full border border-white/15 bg-white/5" />
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
            })}
            {messages.length === 0 ? (
              <div className="text-sm text-white/70">No messages yet.</div>
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
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/15"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
