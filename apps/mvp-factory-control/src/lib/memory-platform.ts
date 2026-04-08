import { prisma } from "@/lib/prisma";
import type {
  MemoryAppInstance,
  MemoryLifecycleState,
  MemoryRecord,
  MemoryScope,
  MemorySourceKind,
  MemoryUserProfile,
  Prisma
} from "@prisma/client";

type MemoryDb = Prisma.TransactionClient | typeof prisma;

export type MemoryActor = {
  userId?: string | null;
  actorRole: string;
};

export type ProvisionAppInstanceInput = {
  key: string;
  displayName?: string | null;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type ProvisionUserProfileInput = {
  key: string;
  userId?: string | null;
  displayName?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type CreateMemoryRecordInput = {
  scope: MemoryScope;
  recordType: string;
  content: string;
  title?: string | null;
  summary?: string | null;
  keywords?: string[];
  confidence?: number | null;
  lifecycleState?: MemoryLifecycleState;
  appKey?: string | null;
  userProfileKey?: string | null;
  sharedChannelKey?: string | null;
  metadata?: Prisma.InputJsonValue;
  source?: {
    kind: MemorySourceKind;
    ref?: string | null;
    title?: string | null;
    metadata?: Prisma.InputJsonValue;
  } | null;
};

export type MemoryRetrievalInput = {
  query?: string | null;
  appKey?: string | null;
  userProfileKey?: string | null;
  includeShared?: boolean;
  limit?: number;
  recordTypes?: string[];
  lifecycleStates?: MemoryLifecycleState[];
};

export type MemoryRetrievalItem = {
  id: string;
  scope: MemoryScope;
  lifecycleState: MemoryLifecycleState;
  recordType: string;
  title: string | null;
  content: string;
  summary: string | null;
  keywords: string[];
  confidence: number | null;
  sharedChannelKey: string | null;
  appKey: string | null;
  userProfileKey: string | null;
  score: number;
  reasons: string[];
  selectedFrom: string;
  source: {
    id: string | null;
    kind: MemorySourceKind | null;
    ref: string | null;
    title: string | null;
  };
};

export type MemoryRetrievalResult = {
  query: string | null;
  precedence: MemoryScope[];
  degraded: boolean;
  items: MemoryRetrievalItem[];
};

export async function listMemoryAppInstances(db: MemoryDb = prisma) {
  return db.memoryAppInstance.findMany({
    orderBy: [{ displayName: "asc" }]
  });
}

export async function listMemoryUserProfiles(db: MemoryDb = prisma) {
  return db.memoryUserProfile.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: [{ displayName: "asc" }, { key: "asc" }]
  });
}

export async function listRecentMemoryRecords(
  params?: {
    limit?: number;
  },
  db: MemoryDb = prisma
) {
  return db.memoryRecord.findMany({
    include: {
      appInstance: true,
      userProfile: true,
      source: true
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(params?.limit ?? 20, 1), 100)
  });
}

function normalizeText(input: string | null | undefined) {
  return String(input || "").trim();
}

function normalizeKey(input: string | null | undefined) {
  return normalizeText(input).toLowerCase();
}

function dedupeStrings(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function clampConfidence(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(value, 0), 1);
}

function requireScopeBindings(input: {
  scope: MemoryScope;
  appKey?: string | null;
  userProfileKey?: string | null;
  sharedChannelKey?: string | null;
}) {
  if (input.scope === "APP" && !normalizeText(input.appKey)) {
    throw new Error("APP memory requires appKey.");
  }
  if (input.scope === "USER" && !normalizeText(input.userProfileKey)) {
    throw new Error("USER memory requires userProfileKey.");
  }
  if (input.scope === "APP_USER") {
    if (!normalizeText(input.appKey) || !normalizeText(input.userProfileKey)) {
      throw new Error("APP_USER memory requires both appKey and userProfileKey.");
    }
  }
  if (input.scope === "SHARED" && !normalizeText(input.sharedChannelKey)) {
    throw new Error("SHARED memory requires sharedChannelKey.");
  }
}

async function recordMemoryEvent(
  db: MemoryDb,
  params: {
    recordId?: string | null;
    eventType: string;
    actorRole: string;
    actorUserId?: string | null;
    reason: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  await db.memoryEvent.create({
    data: {
      recordId: params.recordId ?? null,
      eventType: params.eventType,
      actorRole: params.actorRole,
      actorUserId: params.actorUserId ?? null,
      reason: params.reason,
      metadata: params.metadata
    }
  });
}

async function withMemoryDbTransaction<T>(
  db: MemoryDb,
  callback: (tx: MemoryDb) => Promise<T>
) {
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return db.$transaction(async (tx) => callback(tx));
  }
  return callback(db);
}

export async function provisionMemoryAppInstance(
  input: ProvisionAppInstanceInput,
  db: MemoryDb = prisma
): Promise<MemoryAppInstance> {
  const key = normalizeKey(input.key);
  if (!key) throw new Error("App instance key is required.");
  const displayName = normalizeText(input.displayName) || input.key;
  return db.memoryAppInstance.upsert({
    where: { key },
    create: {
      key,
      displayName,
      description: normalizeText(input.description) || null,
      metadata: input.metadata
    },
    update: {
      displayName,
      description: normalizeText(input.description) || null,
      metadata: input.metadata
    }
  });
}

export async function provisionMemoryUserProfile(
  input: ProvisionUserProfileInput,
  db: MemoryDb = prisma
): Promise<MemoryUserProfile> {
  const key = normalizeKey(input.key);
  if (!key) throw new Error("User profile key is required.");
  return db.memoryUserProfile.upsert({
    where: { key },
    create: {
      key,
      userId: normalizeText(input.userId) || null,
      displayName: normalizeText(input.displayName) || null,
      metadata: input.metadata
    },
    update: {
      userId: normalizeText(input.userId) || null,
      displayName: normalizeText(input.displayName) || null,
      metadata: input.metadata
    }
  });
}

export async function ensureMemoryUserProfileForUser(
  params: {
    userId: string;
    fallbackName?: string | null;
    fallbackEmail?: string | null;
  },
  db: MemoryDb = prisma
) {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, email: true }
  });
  if (!user) {
    throw new Error(`Cannot provision memory profile: user ${params.userId} was not found.`);
  }

  const profileKey =
    normalizeKey(user.email) ||
    normalizeKey(params.fallbackEmail) ||
    normalizeKey(user.name) ||
    normalizeKey(params.fallbackName) ||
    `user-${user.id.toLowerCase()}`;

  return provisionMemoryUserProfile(
    {
      key: profileKey,
      userId: user.id,
      displayName: user.name || params.fallbackName || user.email || params.fallbackEmail || profileKey
    },
    db
  );
}

export async function createMemoryRecord(
  input: CreateMemoryRecordInput,
  actor: MemoryActor,
  db: MemoryDb = prisma
) {
  requireScopeBindings(input);
  const content = normalizeText(input.content);
  if (!content) throw new Error("Memory content is required.");

  return withMemoryDbTransaction(db, async (tx) => {
    const appInstance =
      normalizeText(input.appKey) ?
        await provisionMemoryAppInstance({ key: input.appKey!, displayName: input.appKey }, tx) :
        null;
    const userProfile =
      normalizeText(input.userProfileKey) ?
        await provisionMemoryUserProfile({ key: input.userProfileKey! }, tx) :
        null;

    const source =
      input.source ?
        await tx.memorySource.create({
          data: {
            kind: input.source.kind,
            ref: normalizeText(input.source.ref) || null,
            title: normalizeText(input.source.title) || null,
            metadata: input.source.metadata,
            appInstanceId: appInstance?.id ?? null,
            userProfileId: userProfile?.id ?? null,
            createdByUserId: normalizeText(actor.userId) || null
          }
        }) :
        null;

    const record = await tx.memoryRecord.create({
      data: {
        scope: input.scope,
        lifecycleState: input.lifecycleState ?? "DRAFT",
        recordType: normalizeText(input.recordType) || "note",
        title: normalizeText(input.title) || null,
        content,
        summary: normalizeText(input.summary) || null,
        keywords: dedupeStrings(input.keywords ?? []),
        confidence: clampConfidence(input.confidence),
        appInstanceId: appInstance?.id ?? null,
        userProfileId: userProfile?.id ?? null,
        sharedChannelKey: normalizeText(input.sharedChannelKey) || null,
        sourceId: source?.id ?? null,
        authoredByUserId: normalizeText(actor.userId) || null,
        metadata: input.metadata
      },
      include: {
        appInstance: true,
        userProfile: true,
        source: true
      }
    });

    await recordMemoryEvent(tx, {
      recordId: record.id,
      eventType: "MEMORY_CREATED",
      actorRole: actor.actorRole,
      actorUserId: actor.userId,
      reason: `Created ${record.scope} memory record.`,
      metadata: {
        lifecycleState: record.lifecycleState,
        recordType: record.recordType
      }
    });

    return record;
  });
}

function buildKeywordFilters(query: string) {
  const tokens = dedupeStrings(
    query
      .split(/\s+/)
      .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
      .filter(Boolean)
  );
  return tokens.slice(0, 5);
}

function scopePrecedence(input: { includeShared: boolean; appKey?: string | null; userProfileKey?: string | null }) {
  const precedence: MemoryScope[] = ["GLOBAL"];
  if (normalizeText(input.appKey)) precedence.push("APP");
  if (normalizeText(input.userProfileKey)) precedence.push("USER");
  if (normalizeText(input.appKey) && normalizeText(input.userProfileKey)) precedence.push("APP_USER");
  if (input.includeShared) precedence.push("SHARED");
  return precedence;
}

function computeRetrievalScore(params: {
  record: Prisma.MemoryRecordGetPayload<{
    include: { appInstance: true; userProfile: true; source: true };
  }>;
  query: string;
  queryTokens: string[];
}) {
  let score = 0;
  const reasons: string[] = [];
  const haystacks = [
    params.record.title || "",
    params.record.summary || "",
    params.record.content,
    params.record.keywords.join(" ")
  ]
    .join("\n")
    .toLowerCase();

  const precedenceBoost: Record<MemoryScope, number> = {
    APP_USER: 50,
    USER: 40,
    APP: 30,
    GLOBAL: 20,
    SHARED: 10
  };
  score += precedenceBoost[params.record.scope];
  reasons.push(`scope:${params.record.scope.toLowerCase()}`);

  if (params.query) {
    const queryText = params.query.toLowerCase();
    if (params.record.title?.toLowerCase().includes(queryText)) {
      score += 40;
      reasons.push("title-match");
    }
    if (params.record.summary?.toLowerCase().includes(queryText)) {
      score += 30;
      reasons.push("summary-match");
    }
    if (params.record.content.toLowerCase().includes(queryText)) {
      score += 25;
      reasons.push("content-match");
    }
  }

  for (const token of params.queryTokens) {
    if (!token) continue;
    if (params.record.keywords.some((keyword) => keyword.toLowerCase() === token.toLowerCase())) {
      score += 15;
      reasons.push(`keyword:${token.toLowerCase()}`);
      continue;
    }
    if (haystacks.includes(token.toLowerCase())) {
      score += 6;
      reasons.push(`token:${token.toLowerCase()}`);
    }
  }

  if (params.record.lifecycleState === "HUMAN_APPROVED") {
    score += 20;
    reasons.push("approved");
  } else if (params.record.lifecycleState === "SYSTEM_PROPOSED") {
    score += 8;
    reasons.push("proposed");
  }

  if (params.record.confidence !== null && params.record.confidence !== undefined) {
    score += Math.round(params.record.confidence * 10);
    reasons.push(`confidence:${params.record.confidence.toFixed(2)}`);
  }

  return { score, reasons: dedupeStrings(reasons) };
}

export async function retrieveMemoryContext(
  input: MemoryRetrievalInput,
  db: MemoryDb = prisma
): Promise<MemoryRetrievalResult> {
  const query = normalizeText(input.query);
  const queryTokens = query ? buildKeywordFilters(query) : [];
  const precedence = scopePrecedence({
    includeShared: Boolean(input.includeShared),
    appKey: input.appKey,
    userProfileKey: input.userProfileKey
  });

  const appKey = normalizeKey(input.appKey);
  const userProfileKey = normalizeKey(input.userProfileKey);
  const lifecycleStates: MemoryLifecycleState[] =
    input.lifecycleStates?.length ? input.lifecycleStates : ["HUMAN_APPROVED", "SYSTEM_PROPOSED", "DRAFT"];
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

  const records = await db.memoryRecord.findMany({
    where: {
      lifecycleState: { in: lifecycleStates },
      recordType: input.recordTypes?.length ? { in: input.recordTypes } : undefined,
      OR: precedence.map((scope) => {
        if (scope === "GLOBAL") return { scope: "GLOBAL" as MemoryScope };
        if (scope === "APP") return { scope: "APP" as MemoryScope, appInstance: { key: appKey } };
        if (scope === "USER") return { scope: "USER" as MemoryScope, userProfile: { key: userProfileKey } };
        if (scope === "APP_USER") {
          return {
            scope: "APP_USER" as MemoryScope,
            appInstance: { key: appKey },
            userProfile: { key: userProfileKey }
          };
        }
        return { scope: "SHARED" as MemoryScope };
      })
    },
    include: {
      appInstance: true,
      userProfile: true,
      source: true
    },
    take: 200,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const scored = records
    .map((record) => {
      const { score, reasons } = computeRetrievalScore({ record, query, queryTokens });
      return {
        id: record.id,
        scope: record.scope,
        lifecycleState: record.lifecycleState,
        recordType: record.recordType,
        title: record.title,
        content: record.content,
        summary: record.summary,
        keywords: record.keywords,
        confidence: record.confidence,
        sharedChannelKey: record.sharedChannelKey,
        appKey: record.appInstance?.key ?? null,
        userProfileKey: record.userProfile?.key ?? null,
        score,
        reasons,
        selectedFrom: record.scope.toLowerCase(),
        source: {
          id: record.source?.id ?? null,
          kind: record.source?.kind ?? null,
          ref: record.source?.ref ?? null,
          title: record.source?.title ?? null
        }
      } satisfies MemoryRetrievalItem;
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);

  return {
    query: query || null,
    precedence,
    degraded: true,
    items: scored
  };
}
