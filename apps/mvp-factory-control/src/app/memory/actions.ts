"use server";

/** Server actions for memory platform CRUD after RBAC; revalidates `/memory`. */
import { revalidatePath } from "next/cache";
import { requireRbacAccess } from "@/lib/rbac";
import {
  createMemoryRecord,
  ensureMemoryUserProfileForUser,
  provisionMemoryAppInstance,
  provisionMemoryUserProfile
} from "@/lib/memory-platform";
import type { MemoryLifecycleState, MemoryScope, MemorySourceKind } from "@prisma/client";

function asString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function asStringArray(formData: FormData, key: string) {
  return String(formData.get(key) || "")
    .split(/[\n,]+/g)
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

export async function provisionMemoryAppInstanceAction(formData: FormData) {
  await requireRbacAccess({
    action: "MEMORY_PROVISION_APP_INSTANCE",
    allowedRoles: ["ADMIN", "OPERATOR"],
    entityType: "MEMORY_APP_INSTANCE",
    entityId: asString(formData, "appKey") || null
  });

  const key = asString(formData, "appKey");
  if (!key) throw new Error("App key is required.");

  await provisionMemoryAppInstance({
    key,
    displayName: asString(formData, "appDisplayName") || key,
    description: asString(formData, "appDescription") || null
  });

  revalidatePath("/memory");
}

export async function provisionMemoryUserProfileAction(formData: FormData) {
  const auth = await requireRbacAccess({
    action: "MEMORY_PROVISION_USER_PROFILE",
    allowedRoles: ["ADMIN", "OPERATOR"],
    entityType: "MEMORY_USER_PROFILE",
    entityId: asString(formData, "userProfileKey") || null
  });

  const key = asString(formData, "userProfileKey");
  if (!key) throw new Error("User profile key is required.");

  await provisionMemoryUserProfile({
    key,
    displayName: asString(formData, "userProfileDisplayName") || null,
    userId: auth.userId || null
  });

  revalidatePath("/memory");
}

export async function createMemoryRecordAction(formData: FormData) {
  const auth = await requireRbacAccess({
    action: "MEMORY_CREATE_RECORD",
    allowedRoles: ["ADMIN", "OPERATOR"],
    entityType: "MEMORY_RECORD"
  });

  const scopeRaw = asString(formData, "scope");
  if (!isMemoryScope(scopeRaw)) throw new Error("Valid scope is required.");

  const lifecycleRaw = asString(formData, "lifecycleState");
  if (lifecycleRaw && !isLifecycleState(lifecycleRaw)) {
    throw new Error("Invalid lifecycle state.");
  }
  const lifecycleState = lifecycleRaw ? (lifecycleRaw as MemoryLifecycleState) : undefined;

  const sourceKindRaw = asString(formData, "sourceKind");
  if (sourceKindRaw && !isSourceKind(sourceKindRaw)) {
    throw new Error("Invalid source kind.");
  }
  const sourceKind = sourceKindRaw ? (sourceKindRaw as MemorySourceKind) : undefined;

  const content = asString(formData, "content");
  if (!content) throw new Error("Memory content is required.");

  const appKey = asString(formData, "appKey") || null;
  const explicitUserProfileKey = asString(formData, "userProfileKey");
  const userProfile =
    explicitUserProfileKey ?
      await provisionMemoryUserProfile({
        key: explicitUserProfileKey,
        displayName: explicitUserProfileKey,
        userId: auth.userId || null
      }) :
      auth.userId ?
        await ensureMemoryUserProfileForUser({ userId: auth.userId }) :
        null;

  if (appKey) {
    await provisionMemoryAppInstance({
      key: appKey,
      displayName: appKey
    });
  }

  await createMemoryRecord(
    {
      scope: scopeRaw,
      lifecycleState,
      recordType: asString(formData, "recordType") || "note",
      title: asString(formData, "title") || null,
      content,
      summary: asString(formData, "summary") || null,
      keywords: asStringArray(formData, "keywords"),
      confidence:
        formData.get("confidence") && Number.isFinite(Number(formData.get("confidence"))) ?
          Number(formData.get("confidence")) :
          null,
      appKey,
      userProfileKey: userProfile?.key || null,
      sharedChannelKey: asString(formData, "sharedChannelKey") || null,
      source:
        sourceKind ?
          {
            kind: sourceKind,
            ref: asString(formData, "sourceRef") || null,
            title: asString(formData, "sourceTitle") || null
          } :
          null
    },
    {
      userId: auth.userId,
      actorRole: `RBAC_${auth.role}`
    }
  );

  revalidatePath("/memory");
}
