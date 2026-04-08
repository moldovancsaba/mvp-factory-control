/**
 * REST-style JSON API for memory records (GET retrieve / POST create) authenticated via session cookie.
 * Mirrors capabilities of memory actions for programmatic clients.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createMemoryRecord,
  ensureMemoryUserProfileForUser,
  provisionMemoryAppInstance,
  provisionMemoryUserProfile,
  retrieveMemoryContext
} from "@/lib/memory-platform";
import type { MemoryLifecycleState, MemoryScope, MemorySourceKind } from "@prisma/client";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSessionUserId(session: unknown) {
  // The auth callback attaches `id` to `session.user`, but NextAuth's type does not expose it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (((session as any)?.user as any)?.id as string | undefined) || null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isMemoryScope(value: string): value is MemoryScope {
  return ["GLOBAL", "APP", "USER", "APP_USER", "SHARED"].includes(value);
}

function isLifecycleState(value: string): value is MemoryLifecycleState {
  return ["DRAFT", "SYSTEM_PROPOSED", "HUMAN_APPROVED", "SUPERSEDED", "REVOKED"].includes(value);
}

function isSourceKind(value: string): value is MemorySourceKind {
  return ["MANUAL", "AGENT_SESSION", "SYSTEM_SUMMARY", "IMPORT", "POLICY", "HANDOFF"].includes(value);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = getSessionUserId(session);
  if (!session?.user || !sessionUserId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query");
  const appKey = url.searchParams.get("app");
  const includeShared = url.searchParams.get("includeShared") === "true";
  const requestedProfile = asString(url.searchParams.get("userProfile"));

  try {
    const userProfile =
      requestedProfile ?
        await provisionMemoryUserProfile({ key: requestedProfile, userId: sessionUserId }) :
        await ensureMemoryUserProfileForUser({
          userId: sessionUserId,
          fallbackName: session.user.name,
          fallbackEmail: session.user.email
        });

    const result = await retrieveMemoryContext({
      query,
      appKey,
      userProfileKey: userProfile.key,
      includeShared,
      limit: Number(url.searchParams.get("limit") || "10")
    });

    return NextResponse.json(
      {
        ok: true,
        profile: { key: userProfile.key, displayName: userProfile.displayName },
        ...result
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to retrieve memory context.",
        message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = getSessionUserId(session);
  if (!session?.user || !sessionUserId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const scopeRaw = asString(body.scope);
  if (!isMemoryScope(scopeRaw)) {
    return NextResponse.json({ error: "Invalid or missing memory scope." }, { status: 400 });
  }

  const lifecycleRaw = asString(body.lifecycleState);
  if (lifecycleRaw && !isLifecycleState(lifecycleRaw)) {
    return NextResponse.json({ error: "Invalid lifecycleState." }, { status: 400 });
  }
  const lifecycleState: MemoryLifecycleState | undefined =
    lifecycleRaw ? (lifecycleRaw as MemoryLifecycleState) : undefined;

  const sourceRaw = body.source && typeof body.source === "object" ? (body.source as Record<string, unknown>) : null;
  const sourceKindRaw = sourceRaw ? asString(sourceRaw.kind) : "";
  if (sourceKindRaw && !isSourceKind(sourceKindRaw)) {
    return NextResponse.json({ error: "Invalid source.kind." }, { status: 400 });
  }
  const sourceKind: MemorySourceKind | undefined =
    sourceKindRaw ? (sourceKindRaw as MemorySourceKind) : undefined;

  const recordType = asString(body.recordType) || "note";
  const content = asString(body.content);
  if (!content) {
    return NextResponse.json({ error: "Memory content is required." }, { status: 400 });
  }

  try {
    if (asString(body.appKey)) {
      await provisionMemoryAppInstance({
        key: asString(body.appKey),
        displayName: asString(body.appDisplayName) || asString(body.appKey)
      });
    }

    const userProfile =
      asString(body.userProfileKey) ?
        await provisionMemoryUserProfile({
          key: asString(body.userProfileKey),
          userId: sessionUserId,
          displayName: session.user.name || session.user.email
        }) :
        await ensureMemoryUserProfileForUser({
          userId: sessionUserId,
          fallbackName: session.user.name,
          fallbackEmail: session.user.email
        });

    const record = await createMemoryRecord(
      {
        scope: scopeRaw,
        lifecycleState,
        recordType,
        title: asString(body.title) || null,
        content,
        summary: asString(body.summary) || null,
        keywords: asStringArray(body.keywords),
        confidence:
          typeof body.confidence === "number" ?
            body.confidence :
            Number.isFinite(Number(body.confidence)) ?
              Number(body.confidence) :
              null,
        appKey: asString(body.appKey) || null,
        userProfileKey: userProfile.key,
        sharedChannelKey: asString(body.sharedChannelKey) || null,
        metadata: body.metadata as object | undefined,
        source:
          sourceRaw && sourceKind ?
            {
              kind: sourceKind,
              ref: asString(sourceRaw.ref) || null,
              title: asString(sourceRaw.title) || null,
              metadata: sourceRaw.metadata as object | undefined
            } :
            null
      },
      {
        userId: sessionUserId,
        actorRole: "HUMAN"
      }
    );

    return NextResponse.json(
      {
        ok: true,
        record: {
          id: record.id,
          scope: record.scope,
          lifecycleState: record.lifecycleState,
          recordType: record.recordType,
          title: record.title,
          content: record.content,
          summary: record.summary,
          keywords: record.keywords,
          appKey: record.appInstance?.key ?? null,
          userProfileKey: record.userProfile?.key ?? null,
          sourceId: record.source?.id ?? null
        }
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to create memory record.",
        message
      },
      { status: 500 }
    );
  }
}
