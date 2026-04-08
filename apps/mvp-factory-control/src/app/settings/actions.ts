//> String literal line.
"use server";

/** Server actions for global settings file and taste rubric versions; RBAC admin/operator. */
//> Import bindings from a module.
import { revalidatePath } from "next/cache";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";
//> Import bindings from a module.
import { requireRbacAccess } from "@/lib/rbac";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  getActiveTasteRubricVersion,
  //> Source statement or expression.
  readMVPFactoryControlSettings,
  //> Source statement or expression.
  writeMVPFactoryControlSettings
//> Source statement or expression.
} from "@/lib/settings-store";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  parseTasteRubricPrinciples,
  //> Source statement or expression.
  upsertTasteRubricVersion
//> Source statement or expression.
} from "@/lib/settings-mutations";

//> Export declaration.
export async function saveLocalProjectFolderAction(formData: FormData) {
  //> Await async value.
  await requireRbacAccess({
    //> Source statement or expression.
    action: "SETTINGS_SAVE_LOCAL_PROJECT_FOLDER",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "SETTINGS",
    //> Source statement or expression.
    entityId: "localProjectFolder"
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const localProjectFolder = String(formData.get("localProjectFolder") || "").trim();
  //> Conditional branch.
  if (!localProjectFolder) {
    //> Throw error.
    throw new Error("Local project folder is required.");
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Await async value.
  await writeMVPFactoryControlSettings({
    //> Source statement or expression.
    ...settings,
    //> Source statement or expression.
    localProjectFolder
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}

//> Export declaration.
export async function saveTasteRubricAction(formData: FormData) {
  //> Variable declaration.
  const auth = await requireRbacAccess({
    //> Source statement or expression.
    action: "SETTINGS_SAVE_TASTE_RUBRIC",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "SETTINGS",
    //> Source statement or expression.
    entityId: "taste-rubric"
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const version = String(formData.get("version") || "").trim();
  //> Variable declaration.
  const ownerEmail = String(formData.get("ownerEmail") || "")
    //> Source statement or expression.
    .trim()
    //> Source statement or expression.
    .toLowerCase();
  //> Variable declaration.
  const summary = String(formData.get("summary") || "").trim();
  //> Variable declaration.
  const changeReason = String(formData.get("changeReason") || "").trim();
  //> Variable declaration.
  const principles = parseTasteRubricPrinciples(String(formData.get("principles") || ""));

  //> Conditional branch.
  if (!version) throw new Error("Taste rubric version is required.");
  //> Conditional branch.
  if (!ownerEmail) throw new Error("Taste rubric owner email is required.");
  //> Conditional branch.
  if (!principles.length) throw new Error("Taste rubric principles are required.");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  const currentOwner =
    //> Source statement or expression.
    getActiveTasteRubricVersion(settings)?.ownerEmail?.toLowerCase() || null;
  //> Variable declaration.
  const actorEmail = auth.userEmail?.toLowerCase() || null;
  //> Variable declaration.
  const actorId = auth.userId || "unknown-user";

  //> Conditional branch.
  if (currentOwner && auth.role !== "ADMIN" && actorEmail !== currentOwner) {
    //> Throw error.
    throw new Error(
      //> String literal line.
      `Access denied: only rubric owner (${currentOwner}) or ADMIN can update taste rubric.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const next = await upsertTasteRubricVersion({
    //> Source statement or expression.
    version,
    //> Source statement or expression.
    ownerEmail,
    //> Source statement or expression.
    summary,
    //> Source statement or expression.
    changeReason,
    //> Source statement or expression.
    principles,
    //> Source statement or expression.
    updatedBy: actorEmail || actorId
  //> Brace or statement terminator.
  });

  //> Await async value.
  await prisma.lifecycleAuditEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      entityType: "SETTINGS",
      //> Source statement or expression.
      entityId: "taste-rubric",
      //> Source statement or expression.
      actorRole: `RBAC_${auth.role}`,
      //> Source statement or expression.
      action: "TASTE_RUBRIC_UPDATE",
      //> Source statement or expression.
      allowed: true,
      //> Source statement or expression.
      reason: `Taste rubric version ${next.version} updated by human operator.`,
      //> Source statement or expression.
      metadata: {
        //> Source statement or expression.
        version: next.version,
        //> Source statement or expression.
        ownerEmail: next.ownerEmail,
        //> Source statement or expression.
        updatedBy: next.updatedBy,
        //> Source statement or expression.
        principleCount: next.principles.length,
        //> Source statement or expression.
        changeReason: next.changeReason || null
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}
