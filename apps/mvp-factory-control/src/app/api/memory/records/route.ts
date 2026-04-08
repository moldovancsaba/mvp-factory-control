/**
 * REST-style JSON API for memory records (GET retrieve / POST create) authenticated via session cookie.
 * Mirrors capabilities of memory actions for programmatic clients.
 */
//> Import bindings from a module.
import { NextResponse } from "next/server";
//> Import bindings from a module.
import { getServerSession } from "next-auth";
//> Import bindings from a module.
import { authOptions } from "@/lib/auth";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  createMemoryRecord,
  //> Source statement or expression.
  ensureMemoryUserProfileForUser,
  //> Source statement or expression.
  provisionMemoryAppInstance,
  //> Source statement or expression.
  provisionMemoryUserProfile,
  //> Source statement or expression.
  retrieveMemoryContext
//> Source statement or expression.
} from "@/lib/memory-platform";
//> Import bindings from a module.
import type { MemoryLifecycleState, MemoryScope, MemorySourceKind } from "@prisma/client";

//> Function declaration.
function asString(value: unknown) {
  //> Return a value.
  return typeof value === "string" ? value.trim() : "";
//> Brace or statement terminator.
}

//> Function declaration.
function getSessionUserId(session: unknown) {
  // The auth callback attaches `id` to `session.user`, but NextAuth's type does not expose it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Return a value.
  return (((session as any)?.user as any)?.id as string | undefined) || null;
//> Brace or statement terminator.
}

//> Function declaration.
function asStringArray(value: unknown) {
  //> Conditional branch.
  if (!Array.isArray(value)) return [];
  //> Return a value.
  return value
    //> Source statement or expression.
    .filter((entry): entry is string => typeof entry === "string")
    //> Source statement or expression.
    .map((entry) => entry.trim())
    //> Source statement or expression.
    .filter(Boolean);
//> Brace or statement terminator.
}

//> Function declaration.
function isMemoryScope(value: string): value is MemoryScope {
  //> Return a value.
  return ["GLOBAL", "APP", "USER", "APP_USER", "SHARED"].includes(value);
//> Brace or statement terminator.
}

//> Function declaration.
function isLifecycleState(value: string): value is MemoryLifecycleState {
  //> Return a value.
  return ["DRAFT", "SYSTEM_PROPOSED", "HUMAN_APPROVED", "SUPERSEDED", "REVOKED"].includes(value);
//> Brace or statement terminator.
}

//> Function declaration.
function isSourceKind(value: string): value is MemorySourceKind {
  //> Return a value.
  return ["MANUAL", "AGENT_SESSION", "SYSTEM_SUMMARY", "IMPORT", "POLICY", "HANDOFF"].includes(value);
//> Brace or statement terminator.
}

//> Export declaration.
export async function GET(request: Request) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Variable declaration.
  const sessionUserId = getSessionUserId(session);
  //> Conditional branch.
  if (!session?.user || !sessionUserId) {
    //> Return a value.
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const url = new URL(request.url);
  //> Variable declaration.
  const query = url.searchParams.get("query");
  //> Variable declaration.
  const appKey = url.searchParams.get("app");
  //> Variable declaration.
  const includeShared = url.searchParams.get("includeShared") === "true";
  //> Variable declaration.
  const requestedProfile = asString(url.searchParams.get("userProfile"));

  //> Try block start.
  try {
    //> Variable declaration.
    const userProfile =
      //> Source statement or expression.
      requestedProfile ?
        //> Await async value.
        await provisionMemoryUserProfile({ key: requestedProfile, userId: sessionUserId }) :
        //> Await async value.
        await ensureMemoryUserProfileForUser({
          //> Source statement or expression.
          userId: sessionUserId,
          //> Source statement or expression.
          fallbackName: session.user.name,
          //> Source statement or expression.
          fallbackEmail: session.user.email
        //> Brace or statement terminator.
        });

    //> Variable declaration.
    const result = await retrieveMemoryContext({
      //> Source statement or expression.
      query,
      //> Source statement or expression.
      appKey,
      //> Source statement or expression.
      userProfileKey: userProfile.key,
      //> Source statement or expression.
      includeShared,
      //> Source statement or expression.
      limit: Number(url.searchParams.get("limit") || "10")
    //> Brace or statement terminator.
    });

    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        ok: true,
        //> Source statement or expression.
        profile: { key: userProfile.key, displayName: userProfile.displayName },
        //> Source statement or expression.
        ...result
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: 200 }
    //> Delimiter or separator.
    );
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        error: "Failed to retrieve memory context.",
        //> Source statement or expression.
        message
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: 500 }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Export declaration.
export async function POST(request: Request) {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Variable declaration.
  const sessionUserId = getSessionUserId(session);
  //> Conditional branch.
  if (!session?.user || !sessionUserId) {
    //> Return a value.
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  let body: Record<string, unknown>;
  //> Try block start.
  try {
    //> Source statement or expression.
    body = (await request.json()) as Record<string, unknown>;
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const scopeRaw = asString(body.scope);
  //> Conditional branch.
  if (!isMemoryScope(scopeRaw)) {
    //> Return a value.
    return NextResponse.json({ error: "Invalid or missing memory scope." }, { status: 400 });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const lifecycleRaw = asString(body.lifecycleState);
  //> Conditional branch.
  if (lifecycleRaw && !isLifecycleState(lifecycleRaw)) {
    //> Return a value.
    return NextResponse.json({ error: "Invalid lifecycleState." }, { status: 400 });
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const lifecycleState: MemoryLifecycleState | undefined =
    //> Source statement or expression.
    lifecycleRaw ? (lifecycleRaw as MemoryLifecycleState) : undefined;

  //> Variable declaration.
  const sourceRaw = body.source && typeof body.source === "object" ? (body.source as Record<string, unknown>) : null;
  //> Variable declaration.
  const sourceKindRaw = sourceRaw ? asString(sourceRaw.kind) : "";
  //> Conditional branch.
  if (sourceKindRaw && !isSourceKind(sourceKindRaw)) {
    //> Return a value.
    return NextResponse.json({ error: "Invalid source.kind." }, { status: 400 });
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const sourceKind: MemorySourceKind | undefined =
    //> Source statement or expression.
    sourceKindRaw ? (sourceKindRaw as MemorySourceKind) : undefined;

  //> Variable declaration.
  const recordType = asString(body.recordType) || "note";
  //> Variable declaration.
  const content = asString(body.content);
  //> Conditional branch.
  if (!content) {
    //> Return a value.
    return NextResponse.json({ error: "Memory content is required." }, { status: 400 });
  //> Brace or statement terminator.
  }

  //> Try block start.
  try {
    //> Conditional branch.
    if (asString(body.appKey)) {
      //> Await async value.
      await provisionMemoryAppInstance({
        //> Source statement or expression.
        key: asString(body.appKey),
        //> Source statement or expression.
        displayName: asString(body.appDisplayName) || asString(body.appKey)
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const userProfile =
      //> Source statement or expression.
      asString(body.userProfileKey) ?
        //> Await async value.
        await provisionMemoryUserProfile({
          //> Source statement or expression.
          key: asString(body.userProfileKey),
          //> Source statement or expression.
          userId: sessionUserId,
          //> Source statement or expression.
          displayName: session.user.name || session.user.email
        //> Source statement or expression.
        }) :
        //> Await async value.
        await ensureMemoryUserProfileForUser({
          //> Source statement or expression.
          userId: sessionUserId,
          //> Source statement or expression.
          fallbackName: session.user.name,
          //> Source statement or expression.
          fallbackEmail: session.user.email
        //> Brace or statement terminator.
        });

    //> Variable declaration.
    const record = await createMemoryRecord(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        scope: scopeRaw,
        //> Source statement or expression.
        lifecycleState,
        //> Source statement or expression.
        recordType,
        //> Source statement or expression.
        title: asString(body.title) || null,
        //> Source statement or expression.
        content,
        //> Source statement or expression.
        summary: asString(body.summary) || null,
        //> Source statement or expression.
        keywords: asStringArray(body.keywords),
        //> Source statement or expression.
        confidence:
          //> Source statement or expression.
          typeof body.confidence === "number" ?
            //> Source statement or expression.
            body.confidence :
            //> Source statement or expression.
            Number.isFinite(Number(body.confidence)) ?
              //> Source statement or expression.
              Number(body.confidence) :
              //> Source statement or expression.
              null,
        //> Source statement or expression.
        appKey: asString(body.appKey) || null,
        //> Source statement or expression.
        userProfileKey: userProfile.key,
        //> Source statement or expression.
        sharedChannelKey: asString(body.sharedChannelKey) || null,
        //> Source statement or expression.
        metadata: body.metadata as object | undefined,
        //> Source statement or expression.
        source:
          //> Source statement or expression.
          sourceRaw && sourceKind ?
            //> Brace or statement terminator.
            {
              //> Source statement or expression.
              kind: sourceKind,
              //> Source statement or expression.
              ref: asString(sourceRaw.ref) || null,
              //> Source statement or expression.
              title: asString(sourceRaw.title) || null,
              //> Source statement or expression.
              metadata: sourceRaw.metadata as object | undefined
            //> Source statement or expression.
            } :
            //> Source statement or expression.
            null
      //> Brace or statement terminator.
      },
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        userId: sessionUserId,
        //> Source statement or expression.
        actorRole: "HUMAN"
      //> Brace or statement terminator.
      }
    //> Delimiter or separator.
    );

    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        ok: true,
        //> Source statement or expression.
        record: {
          //> Source statement or expression.
          id: record.id,
          //> Source statement or expression.
          scope: record.scope,
          //> Source statement or expression.
          lifecycleState: record.lifecycleState,
          //> Source statement or expression.
          recordType: record.recordType,
          //> Source statement or expression.
          title: record.title,
          //> Source statement or expression.
          content: record.content,
          //> Source statement or expression.
          summary: record.summary,
          //> Source statement or expression.
          keywords: record.keywords,
          //> Source statement or expression.
          appKey: record.appInstance?.key ?? null,
          //> Source statement or expression.
          userProfileKey: record.userProfile?.key ?? null,
          //> Source statement or expression.
          sourceId: record.source?.id ?? null
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: 201 }
    //> Delimiter or separator.
    );
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        error: "Failed to create memory record.",
        //> Source statement or expression.
        message
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: 500 }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}
