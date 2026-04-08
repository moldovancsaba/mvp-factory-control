//> String literal line.
"use server";

/** Server actions for product rows in settings JSON + GitHub project bootstrap/clean; RBAC operator/admin. */
//> Import bindings from a module.
import path from "node:path";
//> Import bindings from a module.
import { revalidatePath } from "next/cache";
//> Import bindings from a module.
import { ensureSingleSelectOption, getProjectMeta } from "@/lib/github";
//> Import bindings from a module.
import { requireRbacAccess } from "@/lib/rbac";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  cleanProjectSettings,
  //> Source statement or expression.
  parseProjectVars,
  //> Source statement or expression.
  removeProjectSetting,
  //> Source statement or expression.
  upsertProjectSetting
//> Source statement or expression.
} from "@/lib/settings-mutations";

//> Export declaration.
export async function saveProjectConfigAction(formData: FormData) {
  //> Variable declaration.
  const projectId = String(formData.get("projectId") || "").trim();
  //> Variable declaration.
  const projectName = String(formData.get("projectName") || "").trim();
  //> Variable declaration.
  const projectUrl = String(formData.get("projectUrl") || "").trim();
  //> Variable declaration.
  const projectGithub = String(formData.get("projectGithub") || "").trim();
  //> Variable declaration.
  const vars = parseProjectVars(String(formData.get("vars") || ""));

  //> Variable declaration.
  const auth = await requireRbacAccess({
    //> Source statement or expression.
    action: "PRODUCTS_SAVE_PROJECT_CONFIG",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "PROJECT_SETTINGS",
    //> Source statement or expression.
    entityId: projectName || projectId || null,
    //> Source statement or expression.
    metadata: {
      //> Source statement or expression.
      projectName,
      //> Source statement or expression.
      hasProjectGithub: Boolean(projectGithub)
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Await async value.
  await upsertProjectSetting({
    //> Source statement or expression.
    projectId: projectId || undefined,
    //> Source statement or expression.
    projectName,
    //> Source statement or expression.
    projectUrl,
    //> Source statement or expression.
    projectGithub,
    //> Source statement or expression.
    vars
  //> Source statement or expression.
  }, {
    //> Source statement or expression.
    auditContext: {
      //> Source statement or expression.
      actorRole: `RBAC_${auth.role}`,
      //> Source statement or expression.
      actorUserId: auth.userId,
      //> Source statement or expression.
      actorUserEmail: auth.userEmail
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/products");
  //> Source statement or expression.
  revalidatePath(`/products/${encodeURIComponent(projectName)}`);
  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}

//> Export declaration.
export async function deleteProjectConfigAction(formData: FormData) {
  //> Variable declaration.
  const projectId = String(formData.get("projectId") || "").trim();
  //> Variable declaration.
  const projectName = String(formData.get("projectName") || "").trim();

  //> Await async value.
  await requireRbacAccess({
    //> Source statement or expression.
    action: "PRODUCTS_DELETE_PROJECT_CONFIG",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "PROJECT_SETTINGS",
    //> Source statement or expression.
    entityId: projectName || projectId || null,
    //> Source statement or expression.
    metadata: {
      //> Source statement or expression.
      projectName
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Await async value.
  await removeProjectSetting({
    //> Source statement or expression.
    projectId: projectId || undefined,
    //> Source statement or expression.
    projectName: projectName || undefined
  //> Brace or statement terminator.
  });

  //> Conditional branch.
  if (projectName) revalidatePath(`/products/${encodeURIComponent(projectName)}`);
  //> Source statement or expression.
  revalidatePath("/products");
  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}

//> Export declaration.
export async function bootstrapMVPFactoryControlProjectAction() {
  //> Variable declaration.
  const auth = await requireRbacAccess({
    //> Source statement or expression.
    action: "PRODUCTS_BOOTSTRAP_MVP_FACTORY_CONTROL_PROJECT",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "PROJECT_SETTINGS",
    //> Source statement or expression.
    entityId: "mvp-factory-control"
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  //> Variable declaration.
  const repoOwner = process.env.MVP_FACTORY_CONTROL_TASK_REPO_OWNER || "moldovancsaba";
  //> Variable declaration.
  const repoName = process.env.MVP_FACTORY_CONTROL_TASK_REPO_NAME || "mvp-factory-control";

  // IMPORTANT: GitHub's updateProjectV2Field option update can reset existing option IDs.
  // Keep this sync opt-in only until a non-destructive API path is available.
  //> Conditional branch.
  if (process.env.MVP_FACTORY_CONTROL_ENABLE_PRODUCT_OPTION_SYNC === "1") {
    //> Await async value.
    await ensureSingleSelectOption({
      //> Source statement or expression.
      fieldName: "Product",
      //> Source statement or expression.
      optionName: "mvp-factory-control",
      //> Source statement or expression.
      color: "BLUE",
      //> Source statement or expression.
      description: "MVP Factory Control internal control app"
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Await async value.
  await upsertProjectSetting({
    //> Source statement or expression.
    projectName: "mvp-factory-control",
    //> Source statement or expression.
    projectUrl: "http://localhost:3007",
    //> Source statement or expression.
    projectGithub: `https://github.com/${repoOwner}/${repoName}.git`,
    //> Source statement or expression.
    vars: [
      //> Source statement or expression.
      { key: "APP_PATH", value: path.join(repoRoot, "apps", "mvp-factory-control") },
      //> Source statement or expression.
      { key: "WIKI_DOC", value: path.join(repoRoot, "docs", "WIKI.md") },
      //> Source statement or expression.
      { key: "CONTROL_APP_DOC", value: path.join(repoRoot, "docs", "INTERNAL_CONTROL_APP.md") },
      //> Source statement or expression.
      { key: "SETUP_DOC", value: path.join(repoRoot, "docs", "SETUP.md") }
    //> Delimiter or separator.
    ]
  //> Source statement or expression.
  }, {
    //> Source statement or expression.
    auditContext: {
      //> Source statement or expression.
      actorRole: `RBAC_${auth.role}`,
      //> Source statement or expression.
      actorUserId: auth.userId,
      //> Source statement or expression.
      actorUserEmail: auth.userEmail
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  revalidatePath("/products");
  //> Source statement or expression.
  revalidatePath("/products/mvp-factory-control");
  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}

//> Export declaration.
export async function cleanProjectSettingsAction() {
  //> Await async value.
  await requireRbacAccess({
    //> Source statement or expression.
    action: "PRODUCTS_CLEAN_PROJECT_SETTINGS",
    //> Source statement or expression.
    allowedRoles: ["ADMIN", "OPERATOR"],
    //> Source statement or expression.
    entityType: "PROJECT_SETTINGS",
    //> Source statement or expression.
    entityId: "all"
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  let boardProjectNames: string[] = [];
  //> Try block start.
  try {
    //> Variable declaration.
    const meta = await getProjectMeta();
    //> Variable declaration.
    const productField = meta.fields.find((f) => f.name === "Product");
    //> Source statement or expression.
    boardProjectNames = productField?.options?.map((o) => o.name) ?? [];
  //> Source statement or expression.
  } catch {
    // If GitHub metadata is unavailable, still clean locally without board canonicalization.
  //> Brace or statement terminator.
  }

  //> Await async value.
  await cleanProjectSettings({ boardProjectNames });

  //> Source statement or expression.
  revalidatePath("/products");
  //> Source statement or expression.
  revalidatePath("/settings");
//> Brace or statement terminator.
}
