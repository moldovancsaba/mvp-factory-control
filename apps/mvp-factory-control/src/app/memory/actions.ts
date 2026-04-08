//> String literal line.
"use server";

/** Server actions for memory platform CRUD after RBAC; revalidates `/memory`. */
//> Import bindings from a module.
import { revalidatePath } from "next/cache";
//> Import bindings from a module.
import { requireRbacAccess } from "@/lib/rbac";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  createMemoryRecord,
  //> Source statement or expression.
  ensureMemoryUserProfileForUser,
  //> Source statement or expression.
  provisionMemoryAppInstance,
  //> Source statement or expression.
  provisionMemoryUserProfile
//> Source statement or expression.
} from "@/lib/memory-platform";
//> Import bindings from a module.
import type { MemoryLifecycleState, MemoryScope, MemorySourceKind } from "@prisma/client";

//> Function declaration.
function asString(formData: FormData, key: string) {
  //> Return a value.
  return String(formData.get(key) || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function asStringArray(formData: FormData, key: string) {
  //> Return a value.
  return String(formData.get(key) || "")
    //> Source statement or expression.
    .split(/[\n,]+/g)
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
export async function provisionMemoryAppInstanceAction(formData: FormData) {
  //> Await async value.
  await requireRbacAccess({
    //> Source statement or expression.
    action: "MEMORY_PROVISION_APP_INSTANCE",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "MEMORY_APP_INSTANCE",
    //> Source statement or expression.
    entityId: asString(formData, "appKey") || null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const key = asString(formData, "appKey");
  //> Conditional branch.
  if (!key) throw new Error("App key is required.");

  //> Await async value.
  await provisionMemoryAppInstance({
    //> Source statement or expression.
    key,
    //> Source statement or expression.
    displayName: asString(formData, "appDisplayName") || key,
    //> Source statement or expression.
    description: asString(formData, "appDescription") || null
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/memory");
//> Brace or statement terminator.
}

//> Export declaration.
export async function provisionMemoryUserProfileAction(formData: FormData) {
  //> Variable declaration.
  const auth = await requireRbacAccess({
    //> Source statement or expression.
    action: "MEMORY_PROVISION_USER_PROFILE",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "MEMORY_USER_PROFILE",
    //> Source statement or expression.
    entityId: asString(formData, "userProfileKey") || null
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const key = asString(formData, "userProfileKey");
  //> Conditional branch.
  if (!key) throw new Error("User profile key is required.");

  //> Await async value.
  await provisionMemoryUserProfile({
    //> Source statement or expression.
    key,
    //> Source statement or expression.
    displayName: asString(formData, "userProfileDisplayName") || null,
    //> Source statement or expression.
    userId: auth.userId || null
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/memory");
//> Brace or statement terminator.
}

//> Export declaration.
export async function createMemoryRecordAction(formData: FormData) {
  //> Variable declaration.
  const auth = await requireRbacAccess({
    //> Source statement or expression.
    action: "MEMORY_CREATE_RECORD",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "MEMORY_RECORD"
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const scopeRaw = asString(formData, "scope");
  //> Conditional branch.
  if (!isMemoryScope(scopeRaw)) throw new Error("Valid scope is required.");

  //> Variable declaration.
  const lifecycleRaw = asString(formData, "lifecycleState");
  //> Conditional branch.
  if (lifecycleRaw && !isLifecycleState(lifecycleRaw)) {
    //> Throw error.
    throw new Error("Invalid lifecycle state.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const lifecycleState = lifecycleRaw ? (lifecycleRaw as MemoryLifecycleState) : undefined;

  //> Variable declaration.
  const sourceKindRaw = asString(formData, "sourceKind");
  //> Conditional branch.
  if (sourceKindRaw && !isSourceKind(sourceKindRaw)) {
    //> Throw error.
    throw new Error("Invalid source kind.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const sourceKind = sourceKindRaw ? (sourceKindRaw as MemorySourceKind) : undefined;

  //> Variable declaration.
  const content = asString(formData, "content");
  //> Conditional branch.
  if (!content) throw new Error("Memory content is required.");

  //> Variable declaration.
  const appKey = asString(formData, "appKey") || null;
  //> Variable declaration.
  const explicitUserProfileKey = asString(formData, "userProfileKey");
  //> Variable declaration.
  const userProfile =
    //> Source statement or expression.
    explicitUserProfileKey ?
      //> Await async value.
      await provisionMemoryUserProfile({
        //> Source statement or expression.
        key: explicitUserProfileKey,
        //> Source statement or expression.
        displayName: explicitUserProfileKey,
        //> Source statement or expression.
        userId: auth.userId || null
      //> Source statement or expression.
      }) :
      //> Source statement or expression.
      auth.userId ?
        //> Await async value.
        await ensureMemoryUserProfileForUser({ userId: auth.userId }) :
        //> Source statement or expression.
        null;

  //> Conditional branch.
  if (appKey) {
    //> Await async value.
    await provisionMemoryAppInstance({
      //> Source statement or expression.
      key: appKey,
      //> Source statement or expression.
      displayName: appKey
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Await async value.
  await createMemoryRecord(
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      scope: scopeRaw,
      //> Source statement or expression.
      lifecycleState,
      //> Source statement or expression.
      recordType: asString(formData, "recordType") || "note",
      //> Source statement or expression.
      title: asString(formData, "title") || null,
      //> Source statement or expression.
      content,
      //> Source statement or expression.
      summary: asString(formData, "summary") || null,
      //> Source statement or expression.
      keywords: asStringArray(formData, "keywords"),
      //> Source statement or expression.
      confidence:
        //> Source statement or expression.
        formData.get("confidence") && Number.isFinite(Number(formData.get("confidence"))) ?
          //> Source statement or expression.
          Number(formData.get("confidence")) :
          //> Source statement or expression.
          null,
      //> Source statement or expression.
      appKey,
      //> Source statement or expression.
      userProfileKey: userProfile?.key || null,
      //> Source statement or expression.
      sharedChannelKey: asString(formData, "sharedChannelKey") || null,
      //> Source statement or expression.
      source:
        //> Source statement or expression.
        sourceKind ?
          //> Brace or statement terminator.
          {
            //> Source statement or expression.
            kind: sourceKind,
            //> Source statement or expression.
            ref: asString(formData, "sourceRef") || null,
            //> Source statement or expression.
            title: asString(formData, "sourceTitle") || null
          //> Source statement or expression.
          } :
          //> Source statement or expression.
          null
    //> Brace or statement terminator.
    },
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      userId: auth.userId,
      //> Source statement or expression.
      actorRole: `RBAC_${auth.role}`
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  );

  //> Source statement or expression.
  revalidatePath("/memory");
//> Brace or statement terminator.
}
