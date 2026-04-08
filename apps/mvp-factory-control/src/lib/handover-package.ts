/**
 * Alpha **handover package** validation: markdown structure, required sections, and filesystem artifact checks.
 *
 * Spec version `ALPHA_HANDOVER_SPEC_VERSION`. Used by alpha context flows before recording handover refs.
 * Reads optional files from disk when refs point to paths under the repo / allowed roots.
 */
//> Import bindings from a module.
import fs from "node:fs/promises";
//> Import bindings from a module.
import path from "node:path";

//> Export declaration.
export const ALPHA_HANDOVER_SPEC_VERSION = "v1";

//> Variable declaration.
const REQUIRED_SECTION_HEADERS = [
  //> String literal line.
  "# Alpha Handover Artifact v1",
  //> String literal line.
  "## 1) Active Context Metadata",
  //> String literal line.
  "## 2) Objective and Scope",
  //> String literal line.
  "## 3) Completed Since Last Window",
  //> String literal line.
  "## 4) Open Risks / Blockers",
  //> String literal line.
  "## 5) Next Actions (Ordered)",
  //> String literal line.
  "## 6) Continuation Prompt",
  //> String literal line.
  "## 7) Evidence and Links"
//> Source statement or expression.
] as const;

//> Variable declaration.
const REQUIRED_METADATA_FIELDS = [
  //> String literal line.
  "- Project:",
  //> String literal line.
  "- Active Window ID:",
  //> String literal line.
  "- Alpha Owner:",
  //> String literal line.
  "- Context Usage:",
  //> String literal line.
  "- Continuation Prompt Ref:"
//> Source statement or expression.
] as const;

//> Type or interface definition.
type ValidationResult = {
  //> Source statement or expression.
  valid: boolean;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  missingSections: string[];
  //> Source statement or expression.
  missingMetadataFields: string[];
  //> Source statement or expression.
  resolvedPackagePath: string | null;
  //> Source statement or expression.
  resolvedContinuationPath: string | null;
//> Brace or statement terminator.
};

//> Function declaration.
function normalizeText(input: string | null | undefined) {
  //> Return a value.
  return String(input || "").trim();
//> Brace or statement terminator.
}

//> Function declaration.
function repoRootFromCwd() {
  //> Return a value.
  return path.resolve(process.cwd(), "..", "..");
//> Brace or statement terminator.
}

//> Async function declaration.
async function fileExists(filePath: string) {
  //> Try block start.
  try {
    //> Variable declaration.
    const stat = await fs.stat(filePath);
    //> Return a value.
    return stat.isFile();
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return false;
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function resolveLocalDocRef(rawRef: string) {
  //> Variable declaration.
  const ref = normalizeText(rawRef);
  //> Conditional branch.
  if (!ref) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false as const,
      //> Source statement or expression.
      reason: "Reference is empty.",
      //> Source statement or expression.
      path: null as string | null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const [rawPath] = ref.split("#", 1);
  //> Variable declaration.
  const pathPart = normalizeText(rawPath);
  //> Conditional branch.
  if (!pathPart) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false as const,
      //> Source statement or expression.
      reason: `Reference \"${ref}\" is missing a file path.`,
      //> Source statement or expression.
      path: null as string | null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const repoRoot = repoRootFromCwd();
  //> Variable declaration.
  const resolved = path.isAbsolute(pathPart)
    //> Source statement or expression.
    ? path.normalize(pathPart)
    //> Source statement or expression.
    : path.resolve(repoRoot, pathPart);
  //> Variable declaration.
  const relativeToRoot = path.relative(repoRoot, resolved);
  //> Conditional branch.
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false as const,
      //> Source statement or expression.
      reason: `Reference \"${ref}\" points outside repository root.`,
      //> Source statement or expression.
      path: null as string | null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    ok: true as const,
    //> Source statement or expression.
    reason: "",
    //> Source statement or expression.
    path: resolved
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export async function validateAlphaHandoverPackage(params: {
  //> Source statement or expression.
  handoverPackageRef: string;
  //> Source statement or expression.
  continuationPromptRef: string;
  //> Source statement or expression.
  projectName: string;
  //> Source statement or expression.
  activeWindowId: string;
  //> Source statement or expression.
  ownerAgentKey: string;
//> Source statement or expression.
}): Promise<ValidationResult> {
  //> Variable declaration.
  const packageRef = resolveLocalDocRef(params.handoverPackageRef);
  //> Conditional branch.
  if (!packageRef.ok || !packageRef.path) {
    //> Return a value.
    return {
      //> Source statement or expression.
      valid: false,
      //> Source statement or expression.
      reason: `Handover package validation failed: ${packageRef.reason}`,
      //> Source statement or expression.
      missingSections: [],
      //> Source statement or expression.
      missingMetadataFields: [],
      //> Source statement or expression.
      resolvedPackagePath: null,
      //> Source statement or expression.
      resolvedContinuationPath: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (!(await fileExists(packageRef.path))) {
    //> Return a value.
    return {
      //> Source statement or expression.
      valid: false,
      //> Source statement or expression.
      reason: `Handover package validation failed: file not found (${params.handoverPackageRef}).`,
      //> Source statement or expression.
      missingSections: [],
      //> Source statement or expression.
      missingMetadataFields: [],
      //> Source statement or expression.
      resolvedPackagePath: packageRef.path,
      //> Source statement or expression.
      resolvedContinuationPath: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const continuationRef = resolveLocalDocRef(params.continuationPromptRef);
  //> Conditional branch.
  if (!continuationRef.ok || !continuationRef.path) {
    //> Return a value.
    return {
      //> Source statement or expression.
      valid: false,
      //> Source statement or expression.
      reason: `Continuation prompt validation failed: ${continuationRef.reason}`,
      //> Source statement or expression.
      missingSections: [],
      //> Source statement or expression.
      missingMetadataFields: [],
      //> Source statement or expression.
      resolvedPackagePath: packageRef.path,
      //> Source statement or expression.
      resolvedContinuationPath: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (!(await fileExists(continuationRef.path))) {
    //> Return a value.
    return {
      //> Source statement or expression.
      valid: false,
      //> Source statement or expression.
      reason: `Continuation prompt validation failed: file not found (${params.continuationPromptRef}).`,
      //> Source statement or expression.
      missingSections: [],
      //> Source statement or expression.
      missingMetadataFields: [],
      //> Source statement or expression.
      resolvedPackagePath: packageRef.path,
      //> Source statement or expression.
      resolvedContinuationPath: continuationRef.path
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const [packageBody, continuationBody] = await Promise.all([
    //> Source statement or expression.
    fs.readFile(packageRef.path, "utf8"),
    //> Source statement or expression.
    fs.readFile(continuationRef.path, "utf8")
  //> Delimiter or separator.
  ]);

  //> Variable declaration.
  const missingSections = REQUIRED_SECTION_HEADERS.filter((header) => !packageBody.includes(header));
  //> Variable declaration.
  const missingMetadataFields = REQUIRED_METADATA_FIELDS.filter((field) => !packageBody.includes(field));

  //> Variable declaration.
  const contextMismatch: string[] = [];
  //> Conditional branch.
  if (!packageBody.toLowerCase().includes(params.projectName.toLowerCase())) {
    //> Source statement or expression.
    contextMismatch.push(`project name \"${params.projectName}\"`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!packageBody.includes(params.activeWindowId)) {
    //> Source statement or expression.
    contextMismatch.push(`active window id \"${params.activeWindowId}\"`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!packageBody.includes(`@${params.ownerAgentKey}`) && !packageBody.includes(params.ownerAgentKey)) {
    //> Source statement or expression.
    contextMismatch.push(`owner agent \"${params.ownerAgentKey}\"`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!packageBody.includes(params.continuationPromptRef)) {
    //> Source statement or expression.
    contextMismatch.push("continuation prompt reference link");
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const continuationLooksValid = /continue work in/i.test(continuationBody);

  //> Variable declaration.
  const valid =
    //> Source statement or expression.
    missingSections.length === 0 &&
    //> Source statement or expression.
    missingMetadataFields.length === 0 &&
    //> Source statement or expression.
    contextMismatch.length === 0 &&
    //> Source statement or expression.
    continuationLooksValid;

  //> Conditional branch.
  if (valid) {
    //> Return a value.
    return {
      //> Source statement or expression.
      valid: true,
      //> Source statement or expression.
      reason: "Alpha handover package validation passed.",
      //> Source statement or expression.
      missingSections: [],
      //> Source statement or expression.
      missingMetadataFields: [],
      //> Source statement or expression.
      resolvedPackagePath: packageRef.path,
      //> Source statement or expression.
      resolvedContinuationPath: continuationRef.path
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const reasons: string[] = [];
  //> Conditional branch.
  if (missingSections.length > 0) {
    //> Source statement or expression.
    reasons.push(`missing sections: ${missingSections.join(", ")}`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (missingMetadataFields.length > 0) {
    //> Source statement or expression.
    reasons.push(`missing metadata fields: ${missingMetadataFields.join(", ")}`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (contextMismatch.length > 0) {
    //> Source statement or expression.
    reasons.push(`missing context links: ${contextMismatch.join(", ")}`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!continuationLooksValid) {
    //> Source statement or expression.
    reasons.push(
      //> String literal line.
      `continuation prompt ref must point to content containing \"Continue work in ...\"`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    valid: false,
    //> Source statement or expression.
    reason: `Handover package validation failed: ${reasons.join("; ")}`,
    //> Source statement or expression.
    missingSections,
    //> Source statement or expression.
    missingMetadataFields,
    //> Source statement or expression.
    resolvedPackagePath: packageRef.path,
    //> Source statement or expression.
    resolvedContinuationPath: continuationRef.path
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
