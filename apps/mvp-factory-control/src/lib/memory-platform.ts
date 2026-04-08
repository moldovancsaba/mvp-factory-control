/**
 * Durable memory platform: Prisma-backed memory records, app instances, user profiles, retrieval scoring.
 *
 * Implements create/list/search flows used by `src/app/api/memory/records` and the Memory UI.
 * Types align with Prisma models (`MemoryRecord`, `MemoryScope`, etc.). All public exports are
 * async and accept an optional transaction client for call-site composability.
 */
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import type {
  //> Source statement or expression.
  MemoryAppInstance,
  //> Source statement or expression.
  MemoryLifecycleState,
  //> Source statement or expression.
  MemoryRecord,
  //> Source statement or expression.
  MemoryScope,
  //> Source statement or expression.
  MemorySourceKind,
  //> Source statement or expression.
  MemoryUserProfile,
  //> Source statement or expression.
  Prisma
//> Source statement or expression.
} from "@prisma/client";

//> Type or interface definition.
type MemoryDb = Prisma.TransactionClient | typeof prisma;

//> Export declaration.
export type MemoryActor = {
  //> Source statement or expression.
  userId?: string | null;
  //> Source statement or expression.
  actorRole: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type ProvisionAppInstanceInput = {
  //> Source statement or expression.
  key: string;
  //> Source statement or expression.
  displayName?: string | null;
  //> Source statement or expression.
  description?: string | null;
  //> Source statement or expression.
  metadata?: Prisma.InputJsonValue;
//> Brace or statement terminator.
};

//> Export declaration.
export type ProvisionUserProfileInput = {
  //> Source statement or expression.
  key: string;
  //> Source statement or expression.
  userId?: string | null;
  //> Source statement or expression.
  displayName?: string | null;
  //> Source statement or expression.
  metadata?: Prisma.InputJsonValue;
//> Brace or statement terminator.
};

//> Export declaration.
export type CreateMemoryRecordInput = {
  //> Source statement or expression.
  scope: MemoryScope;
  //> Source statement or expression.
  recordType: string;
  //> Source statement or expression.
  content: string;
  //> Source statement or expression.
  title?: string | null;
  //> Source statement or expression.
  summary?: string | null;
  //> Source statement or expression.
  keywords?: string[];
  //> Source statement or expression.
  confidence?: number | null;
  //> Source statement or expression.
  lifecycleState?: MemoryLifecycleState;
  //> Source statement or expression.
  appKey?: string | null;
  //> Source statement or expression.
  userProfileKey?: string | null;
  //> Source statement or expression.
  sharedChannelKey?: string | null;
  //> Source statement or expression.
  metadata?: Prisma.InputJsonValue;
  //> Source statement or expression.
  source?: {
    //> Source statement or expression.
    kind: MemorySourceKind;
    //> Source statement or expression.
    ref?: string | null;
    //> Source statement or expression.
    title?: string | null;
    //> Source statement or expression.
    metadata?: Prisma.InputJsonValue;
  //> Source statement or expression.
  } | null;
//> Brace or statement terminator.
};

//> Export declaration.
export type MemoryRetrievalInput = {
  //> Source statement or expression.
  query?: string | null;
  //> Source statement or expression.
  appKey?: string | null;
  //> Source statement or expression.
  userProfileKey?: string | null;
  //> Source statement or expression.
  includeShared?: boolean;
  //> Source statement or expression.
  limit?: number;
  //> Source statement or expression.
  recordTypes?: string[];
  //> Source statement or expression.
  lifecycleStates?: MemoryLifecycleState[];
//> Brace or statement terminator.
};

//> Export declaration.
export type MemoryRetrievalItem = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  scope: MemoryScope;
  //> Source statement or expression.
  lifecycleState: MemoryLifecycleState;
  //> Source statement or expression.
  recordType: string;
  //> Source statement or expression.
  title: string | null;
  //> Source statement or expression.
  content: string;
  //> Source statement or expression.
  summary: string | null;
  //> Source statement or expression.
  keywords: string[];
  //> Source statement or expression.
  confidence: number | null;
  //> Source statement or expression.
  sharedChannelKey: string | null;
  //> Source statement or expression.
  appKey: string | null;
  //> Source statement or expression.
  userProfileKey: string | null;
  //> Source statement or expression.
  score: number;
  //> Source statement or expression.
  reasons: string[];
  //> Source statement or expression.
  selectedFrom: string;
  //> Source statement or expression.
  source: {
    //> Source statement or expression.
    id: string | null;
    //> Source statement or expression.
    kind: MemorySourceKind | null;
    //> Source statement or expression.
    ref: string | null;
    //> Source statement or expression.
    title: string | null;
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
};

//> Export declaration.
export type MemoryRetrievalResult = {
  //> Source statement or expression.
  query: string | null;
  //> Source statement or expression.
  precedence: MemoryScope[];
  //> Source statement or expression.
  degraded: boolean;
  //> Source statement or expression.
  items: MemoryRetrievalItem[];
//> Brace or statement terminator.
};

//> Export declaration.
export async function listMemoryAppInstances(db: MemoryDb = prisma) {
  //> Return a value.
  return db.memoryAppInstance.findMany({
    //> Source statement or expression.
    orderBy: [{ displayName: "asc" }]
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function listMemoryUserProfiles(db: MemoryDb = prisma) {
  //> Return a value.
  return db.memoryUserProfile.findMany({
    //> Source statement or expression.
    include: { user: { select: { email: true, name: true } } },
    //> Source statement or expression.
    orderBy: [{ displayName: "asc" }, { key: "asc" }]
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function listRecentMemoryRecords(
  //> Source statement or expression.
  params?: {
    //> Source statement or expression.
    limit?: number;
  //> Brace or statement terminator.
  },
  //> Source statement or expression.
  db: MemoryDb = prisma
//> Source statement or expression.
) {
  //> Return a value.
  return db.memoryRecord.findMany({
    //> Source statement or expression.
    include: {
      //> Source statement or expression.
      appInstance: true,
      //> Source statement or expression.
      userProfile: true,
      //> Source statement or expression.
      source: true
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    //> Source statement or expression.
    take: Math.min(Math.max(params?.limit ?? 20, 1), 100)
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeText(input: string | null | undefined) {
  //> Return a value.
  return String(input || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function normalizeKey(input: string | null | undefined) {
  //> Return a value.
  return normalizeText(input).toLowerCase();
//> Brace or statement terminator.
}

//> Function declaration.
function dedupeStrings(values: string[]) {
  //> Variable declaration.
  const out: string[] = [];
  //> Variable declaration.
  const seen = new Set<string>();
  //> For-loop header.
  for (const value of values) {
    //> Variable declaration.
    const normalized = normalizeText(value);
    //> Conditional branch.
    if (!normalized) continue;
    //> Variable declaration.
    const key = normalized.toLowerCase();
    //> Conditional branch.
    if (seen.has(key)) continue;
    //> Source statement or expression.
    seen.add(key);
    //> Source statement or expression.
    out.push(normalized);
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Function declaration.
function clampConfidence(value: number | null | undefined) {
  //> Conditional branch.
  if (value === null || value === undefined) return null;
  //> Conditional branch.
  if (!Number.isFinite(value)) return null;
  //> Return a value.
  return Math.min(Math.max(value, 0), 1);
//> Brace or statement terminator.
}

//> Function declaration.
function requireScopeBindings(input: {
  //> Source statement or expression.
  scope: MemoryScope;
  //> Source statement or expression.
  appKey?: string | null;
  //> Source statement or expression.
  userProfileKey?: string | null;
  //> Source statement or expression.
  sharedChannelKey?: string | null;
//> Source statement or expression.
}) {
  //> Conditional branch.
  if (input.scope === "APP" && !normalizeText(input.appKey)) {
    //> Throw error.
    throw new Error("APP memory requires appKey.");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (input.scope === "USER" && !normalizeText(input.userProfileKey)) {
    //> Throw error.
    throw new Error("USER memory requires userProfileKey.");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (input.scope === "APP_USER") {
    //> Conditional branch.
    if (!normalizeText(input.appKey) || !normalizeText(input.userProfileKey)) {
      //> Throw error.
      throw new Error("APP_USER memory requires both appKey and userProfileKey.");
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (input.scope === "SHARED" && !normalizeText(input.sharedChannelKey)) {
    //> Throw error.
    throw new Error("SHARED memory requires sharedChannelKey.");
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Async function declaration.
async function recordMemoryEvent(
  //> Source statement or expression.
  db: MemoryDb,
  //> Source statement or expression.
  params: {
    //> Source statement or expression.
    recordId?: string | null;
    //> Source statement or expression.
    eventType: string;
    //> Source statement or expression.
    actorRole: string;
    //> Source statement or expression.
    actorUserId?: string | null;
    //> Source statement or expression.
    reason: string;
    //> Source statement or expression.
    metadata?: Prisma.InputJsonValue;
  //> Brace or statement terminator.
  }
//> Source statement or expression.
) {
  //> Await async value.
  await db.memoryEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      recordId: params.recordId ?? null,
      //> Source statement or expression.
      eventType: params.eventType,
      //> Source statement or expression.
      actorRole: params.actorRole,
      //> Source statement or expression.
      actorUserId: params.actorUserId ?? null,
      //> Source statement or expression.
      reason: params.reason,
      //> Source statement or expression.
      metadata: params.metadata
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Async function declaration.
async function withMemoryDbTransaction<T>(
  //> Source statement or expression.
  db: MemoryDb,
  //> Source statement or expression.
  callback: (tx: MemoryDb) => Promise<T>
//> Source statement or expression.
) {
  //> Conditional branch.
  if ("$transaction" in db && typeof db.$transaction === "function") {
    //> Return a value.
    return db.$transaction(async (tx) => callback(tx));
  //> Brace or statement terminator.
  }
  //> Return a value.
  return callback(db);
//> Brace or statement terminator.
}

//> Export declaration.
export async function provisionMemoryAppInstance(
  //> Source statement or expression.
  input: ProvisionAppInstanceInput,
  //> Source statement or expression.
  db: MemoryDb = prisma
//> Source statement or expression.
): Promise<MemoryAppInstance> {
  //> Variable declaration.
  const key = normalizeKey(input.key);
  //> Conditional branch.
  if (!key) throw new Error("App instance key is required.");
  //> Variable declaration.
  const displayName = normalizeText(input.displayName) || input.key;
  //> Return a value.
  return db.memoryAppInstance.upsert({
    //> Source statement or expression.
    where: { key },
    //> Source statement or expression.
    create: {
      //> Source statement or expression.
      key,
      //> Source statement or expression.
      displayName,
      //> Source statement or expression.
      description: normalizeText(input.description) || null,
      //> Source statement or expression.
      metadata: input.metadata
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    update: {
      //> Source statement or expression.
      displayName,
      //> Source statement or expression.
      description: normalizeText(input.description) || null,
      //> Source statement or expression.
      metadata: input.metadata
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function provisionMemoryUserProfile(
  //> Source statement or expression.
  input: ProvisionUserProfileInput,
  //> Source statement or expression.
  db: MemoryDb = prisma
//> Source statement or expression.
): Promise<MemoryUserProfile> {
  //> Variable declaration.
  const key = normalizeKey(input.key);
  //> Conditional branch.
  if (!key) throw new Error("User profile key is required.");
  //> Return a value.
  return db.memoryUserProfile.upsert({
    //> Source statement or expression.
    where: { key },
    //> Source statement or expression.
    create: {
      //> Source statement or expression.
      key,
      //> Source statement or expression.
      userId: normalizeText(input.userId) || null,
      //> Source statement or expression.
      displayName: normalizeText(input.displayName) || null,
      //> Source statement or expression.
      metadata: input.metadata
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    update: {
      //> Source statement or expression.
      userId: normalizeText(input.userId) || null,
      //> Source statement or expression.
      displayName: normalizeText(input.displayName) || null,
      //> Source statement or expression.
      metadata: input.metadata
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function ensureMemoryUserProfileForUser(
  //> Source statement or expression.
  params: {
    //> Source statement or expression.
    userId: string;
    //> Source statement or expression.
    fallbackName?: string | null;
    //> Source statement or expression.
    fallbackEmail?: string | null;
  //> Brace or statement terminator.
  },
  //> Source statement or expression.
  db: MemoryDb = prisma
//> Source statement or expression.
) {
  //> Variable declaration.
  const user = await db.user.findUnique({
    //> Source statement or expression.
    where: { id: params.userId },
    //> Source statement or expression.
    select: { id: true, name: true, email: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!user) {
    //> Throw error.
    throw new Error(`Cannot provision memory profile: user ${params.userId} was not found.`);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const profileKey =
    //> Source statement or expression.
    normalizeKey(user.email) ||
    //> Source statement or expression.
    normalizeKey(params.fallbackEmail) ||
    //> Source statement or expression.
    normalizeKey(user.name) ||
    //> Source statement or expression.
    normalizeKey(params.fallbackName) ||
    //> String literal line.
    `user-${user.id.toLowerCase()}`;

  //> Return a value.
  return provisionMemoryUserProfile(
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      key: profileKey,
      //> Source statement or expression.
      userId: user.id,
      //> Source statement or expression.
      displayName: user.name || params.fallbackName || user.email || params.fallbackEmail || profileKey
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    db
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Export declaration.
export async function createMemoryRecord(
  //> Source statement or expression.
  input: CreateMemoryRecordInput,
  //> Source statement or expression.
  actor: MemoryActor,
  //> Source statement or expression.
  db: MemoryDb = prisma
//> Source statement or expression.
) {
  //> Source statement or expression.
  requireScopeBindings(input);
  //> Variable declaration.
  const content = normalizeText(input.content);
  //> Conditional branch.
  if (!content) throw new Error("Memory content is required.");

  //> Return a value.
  return withMemoryDbTransaction(db, async (tx) => {
    //> Variable declaration.
    const appInstance =
      //> Source statement or expression.
      normalizeText(input.appKey) ?
        //> Await async value.
        await provisionMemoryAppInstance({ key: input.appKey!, displayName: input.appKey }, tx) :
        //> Source statement or expression.
        null;
    //> Variable declaration.
    const userProfile =
      //> Source statement or expression.
      normalizeText(input.userProfileKey) ?
        //> Await async value.
        await provisionMemoryUserProfile({ key: input.userProfileKey! }, tx) :
        //> Source statement or expression.
        null;

    //> Variable declaration.
    const source =
      //> Source statement or expression.
      input.source ?
        //> Await async value.
        await tx.memorySource.create({
          //> Source statement or expression.
          data: {
            //> Source statement or expression.
            kind: input.source.kind,
            //> Source statement or expression.
            ref: normalizeText(input.source.ref) || null,
            //> Source statement or expression.
            title: normalizeText(input.source.title) || null,
            //> Source statement or expression.
            metadata: input.source.metadata,
            //> Source statement or expression.
            appInstanceId: appInstance?.id ?? null,
            //> Source statement or expression.
            userProfileId: userProfile?.id ?? null,
            //> Source statement or expression.
            createdByUserId: normalizeText(actor.userId) || null
          //> Brace or statement terminator.
          }
        //> Source statement or expression.
        }) :
        //> Source statement or expression.
        null;

    //> Variable declaration.
    const record = await tx.memoryRecord.create({
      //> Source statement or expression.
      data: {
        //> Source statement or expression.
        scope: input.scope,
        //> Source statement or expression.
        lifecycleState: input.lifecycleState ?? "DRAFT",
        //> Source statement or expression.
        recordType: normalizeText(input.recordType) || "note",
        //> Source statement or expression.
        title: normalizeText(input.title) || null,
        //> Source statement or expression.
        content,
        //> Source statement or expression.
        summary: normalizeText(input.summary) || null,
        //> Source statement or expression.
        keywords: dedupeStrings(input.keywords ?? []),
        //> Source statement or expression.
        confidence: clampConfidence(input.confidence),
        //> Source statement or expression.
        appInstanceId: appInstance?.id ?? null,
        //> Source statement or expression.
        userProfileId: userProfile?.id ?? null,
        //> Source statement or expression.
        sharedChannelKey: normalizeText(input.sharedChannelKey) || null,
        //> Source statement or expression.
        sourceId: source?.id ?? null,
        //> Source statement or expression.
        authoredByUserId: normalizeText(actor.userId) || null,
        //> Source statement or expression.
        metadata: input.metadata
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      include: {
        //> Source statement or expression.
        appInstance: true,
        //> Source statement or expression.
        userProfile: true,
        //> Source statement or expression.
        source: true
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Await async value.
    await recordMemoryEvent(tx, {
      //> Source statement or expression.
      recordId: record.id,
      //> Source statement or expression.
      eventType: "MEMORY_CREATED",
      //> Source statement or expression.
      actorRole: actor.actorRole,
      //> Source statement or expression.
      actorUserId: actor.userId,
      //> Source statement or expression.
      reason: `Created ${record.scope} memory record.`,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        lifecycleState: record.lifecycleState,
        //> Source statement or expression.
        recordType: record.recordType
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    });

    //> Return a value.
    return record;
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Function declaration.
function buildKeywordFilters(query: string) {
  //> Variable declaration.
  const tokens = dedupeStrings(
    //> Source statement or expression.
    query
      //> Source statement or expression.
      .split(/\s+/)
      //> Source statement or expression.
      .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
      //> Source statement or expression.
      .filter(Boolean)
  //> Delimiter or separator.
  );
  //> Return a value.
  return tokens.slice(0, 5);
//> Brace or statement terminator.
}

//> Function declaration.
function scopePrecedence(input: { includeShared: boolean; appKey?: string | null; userProfileKey?: string | null }) {
  //> Variable declaration.
  const precedence: MemoryScope[] = ["GLOBAL"];
  //> Conditional branch.
  if (normalizeText(input.appKey)) precedence.push("APP");
  //> Conditional branch.
  if (normalizeText(input.userProfileKey)) precedence.push("USER");
  //> Conditional branch.
  if (normalizeText(input.appKey) && normalizeText(input.userProfileKey)) precedence.push("APP_USER");
  //> Conditional branch.
  if (input.includeShared) precedence.push("SHARED");
  //> Return a value.
  return precedence;
//> Brace or statement terminator.
}

//> Function declaration.
function computeRetrievalScore(params: {
  //> Source statement or expression.
  record: Prisma.MemoryRecordGetPayload<{
    //> Source statement or expression.
    include: { appInstance: true; userProfile: true; source: true };
  //> Delimiter or separator.
  }>;
  //> Source statement or expression.
  query: string;
  //> Source statement or expression.
  queryTokens: string[];
//> Source statement or expression.
}) {
  //> Variable declaration.
  let score = 0;
  //> Variable declaration.
  const reasons: string[] = [];
  //> Variable declaration.
  const haystacks = [
    //> Source statement or expression.
    params.record.title || "",
    //> Source statement or expression.
    params.record.summary || "",
    //> Source statement or expression.
    params.record.content,
    //> Source statement or expression.
    params.record.keywords.join(" ")
  //> Delimiter or separator.
  ]
    //> Source statement or expression.
    .join("\n")
    //> Source statement or expression.
    .toLowerCase();

  //> Variable declaration.
  const precedenceBoost: Record<MemoryScope, number> = {
    //> Source statement or expression.
    APP_USER: 50,
    //> Source statement or expression.
    USER: 40,
    //> Source statement or expression.
    APP: 30,
    //> Source statement or expression.
    GLOBAL: 20,
    //> Source statement or expression.
    SHARED: 10
  //> Brace or statement terminator.
  };
  //> Source statement or expression.
  score += precedenceBoost[params.record.scope];
  //> Source statement or expression.
  reasons.push(`scope:${params.record.scope.toLowerCase()}`);

  //> Conditional branch.
  if (params.query) {
    //> Variable declaration.
    const queryText = params.query.toLowerCase();
    //> Conditional branch.
    if (params.record.title?.toLowerCase().includes(queryText)) {
      //> Source statement or expression.
      score += 40;
      //> Source statement or expression.
      reasons.push("title-match");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (params.record.summary?.toLowerCase().includes(queryText)) {
      //> Source statement or expression.
      score += 30;
      //> Source statement or expression.
      reasons.push("summary-match");
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (params.record.content.toLowerCase().includes(queryText)) {
      //> Source statement or expression.
      score += 25;
      //> Source statement or expression.
      reasons.push("content-match");
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> For-loop header.
  for (const token of params.queryTokens) {
    //> Conditional branch.
    if (!token) continue;
    //> Conditional branch.
    if (params.record.keywords.some((keyword) => keyword.toLowerCase() === token.toLowerCase())) {
      //> Source statement or expression.
      score += 15;
      //> Source statement or expression.
      reasons.push(`keyword:${token.toLowerCase()}`);
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (haystacks.includes(token.toLowerCase())) {
      //> Source statement or expression.
      score += 6;
      //> Source statement or expression.
      reasons.push(`token:${token.toLowerCase()}`);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (params.record.lifecycleState === "HUMAN_APPROVED") {
    //> Source statement or expression.
    score += 20;
    //> Source statement or expression.
    reasons.push("approved");
  //> Source statement or expression.
  } else if (params.record.lifecycleState === "SYSTEM_PROPOSED") {
    //> Source statement or expression.
    score += 8;
    //> Source statement or expression.
    reasons.push("proposed");
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (params.record.confidence !== null && params.record.confidence !== undefined) {
    //> Source statement or expression.
    score += Math.round(params.record.confidence * 10);
    //> Source statement or expression.
    reasons.push(`confidence:${params.record.confidence.toFixed(2)}`);
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { score, reasons: dedupeStrings(reasons) };
//> Brace or statement terminator.
}

//> Export declaration.
export async function retrieveMemoryContext(
  //> Source statement or expression.
  input: MemoryRetrievalInput,
  //> Source statement or expression.
  db: MemoryDb = prisma
//> Source statement or expression.
): Promise<MemoryRetrievalResult> {
  //> Variable declaration.
  const query = normalizeText(input.query);
  //> Variable declaration.
  const queryTokens = query ? buildKeywordFilters(query) : [];
  //> Variable declaration.
  const precedence = scopePrecedence({
    //> Source statement or expression.
    includeShared: Boolean(input.includeShared),
    //> Source statement or expression.
    appKey: input.appKey,
    //> Source statement or expression.
    userProfileKey: input.userProfileKey
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const appKey = normalizeKey(input.appKey);
  //> Variable declaration.
  const userProfileKey = normalizeKey(input.userProfileKey);
  //> Variable declaration.
  const lifecycleStates: MemoryLifecycleState[] =
    //> Source statement or expression.
    input.lifecycleStates?.length ? input.lifecycleStates : ["HUMAN_APPROVED", "SYSTEM_PROPOSED", "DRAFT"];
  //> Variable declaration.
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

  //> Variable declaration.
  const records = await db.memoryRecord.findMany({
    //> Source statement or expression.
    where: {
      //> Source statement or expression.
      lifecycleState: { in: lifecycleStates },
      //> Source statement or expression.
      recordType: input.recordTypes?.length ? { in: input.recordTypes } : undefined,
      //> Source statement or expression.
      OR: precedence.map((scope) => {
        //> Conditional branch.
        if (scope === "GLOBAL") return { scope: "GLOBAL" as MemoryScope };
        //> Conditional branch.
        if (scope === "APP") return { scope: "APP" as MemoryScope, appInstance: { key: appKey } };
        //> Conditional branch.
        if (scope === "USER") return { scope: "USER" as MemoryScope, userProfile: { key: userProfileKey } };
        //> Conditional branch.
        if (scope === "APP_USER") {
          //> Return a value.
          return {
            //> Source statement or expression.
            scope: "APP_USER" as MemoryScope,
            //> Source statement or expression.
            appInstance: { key: appKey },
            //> Source statement or expression.
            userProfile: { key: userProfileKey }
          //> Brace or statement terminator.
          };
        //> Brace or statement terminator.
        }
        //> Return a value.
        return { scope: "SHARED" as MemoryScope };
      //> Delimiter or separator.
      })
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    include: {
      //> Source statement or expression.
      appInstance: true,
      //> Source statement or expression.
      userProfile: true,
      //> Source statement or expression.
      source: true
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    take: 200,
    //> Source statement or expression.
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const scored = records
    //> Source statement or expression.
    .map((record) => {
      //> Variable declaration.
      const { score, reasons } = computeRetrievalScore({ record, query, queryTokens });
      //> Return a value.
      return {
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
        confidence: record.confidence,
        //> Source statement or expression.
        sharedChannelKey: record.sharedChannelKey,
        //> Source statement or expression.
        appKey: record.appInstance?.key ?? null,
        //> Source statement or expression.
        userProfileKey: record.userProfile?.key ?? null,
        //> Source statement or expression.
        score,
        //> Source statement or expression.
        reasons,
        //> Source statement or expression.
        selectedFrom: record.scope.toLowerCase(),
        //> Source statement or expression.
        source: {
          //> Source statement or expression.
          id: record.source?.id ?? null,
          //> Source statement or expression.
          kind: record.source?.kind ?? null,
          //> Source statement or expression.
          ref: record.source?.ref ?? null,
          //> Source statement or expression.
          title: record.source?.title ?? null
        //> Brace or statement terminator.
        }
      //> Source statement or expression.
      } satisfies MemoryRetrievalItem;
    //> Delimiter or separator.
    })
    //> Source statement or expression.
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    //> Source statement or expression.
    .slice(0, limit);

  //> Return a value.
  return {
    //> Source statement or expression.
    query: query || null,
    //> Source statement or expression.
    precedence,
    //> Source statement or expression.
    degraded: true,
    //> Source statement or expression.
    items: scored
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
