/**
 * Validates GitHub issue bodies for the **Executable Prompt Package** shape (markdown headings).
 *
 * - Parses ATX headings with `HEADING_RE`, classifies sections via `classifyHeading` / `normalizeHeading`.
 * - Enforced sections match `docs/EXECUTABLE_PROMPT_PACKAGE.md` **except** "Product" (human/portfolio metadata only).
 * - `hasSubstance` strips markdown noise and rejects placeholders (tbd, todo, ...).
 * - Acceptance checks must include bullet or `- [ ]` checklist lines per `hasAcceptanceChecklist`.
 * - `promptPackageMissingSummary` builds a single operator-facing string for UI.
 */
//> Export declaration.
export type ExecutablePromptSectionKey =
  //> Source statement or expression.
  | "objective"
  //> Source statement or expression.
  | "executionPrompt"
  //> Source statement or expression.
  | "scopeNonGoals"
  //> Source statement or expression.
  | "scope"
  //> Source statement or expression.
  | "nonGoals"
  //> Source statement or expression.
  | "constraints"
  //> Source statement or expression.
  | "acceptanceChecks"
  //> Source statement or expression.
  | "deliveryArtifact";

//> Export declaration.
export type ExecutablePromptValidation = {
  //> Source statement or expression.
  valid: boolean;
  //> Source statement or expression.
  missingSections: string[];
  //> Source statement or expression.
  weakSections: string[];
  //> Source statement or expression.
  sections: Record<ExecutablePromptSectionKey, string>;
//> Brace or statement terminator.
};

//> Variable declaration.
const REQUIRED_SECTION_LABELS = [
  //> Source statement or expression.
  { key: "objective", label: "Objective" },
  //> Source statement or expression.
  { key: "executionPrompt", label: "Execution Prompt" },
  //> Source statement or expression.
  { key: "scopeNonGoals", label: "Scope / Non-goals (or both Scope + Non-goals)" },
  //> Source statement or expression.
  { key: "constraints", label: "Constraints" },
  //> Source statement or expression.
  { key: "acceptanceChecks", label: "Acceptance Checks" },
  //> Source statement or expression.
  { key: "deliveryArtifact", label: "Delivery Artifact" }
//> Source statement or expression.
] as const;

//> Variable declaration.
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/gm;

//> Function declaration.
function normalizeHeading(input: string) {
  //> Return a value.
  return input
    //> Source statement or expression.
    .toLowerCase()
    //> Source statement or expression.
    .replace(/[`*_~]/g, "")
    //> Source statement or expression.
    .replace(/&/g, "and")
    //> Source statement or expression.
    .replace(/[^a-z0-9/\s-]/g, " ")
    //> Source statement or expression.
    .replace(/\s+/g, " ")
    //> Source statement or expression.
    .trim();
//> Brace or statement terminator.
}

//> Function declaration.
function classifyHeading(rawHeading: string): ExecutablePromptSectionKey | null {
  //> Variable declaration.
  const heading = normalizeHeading(rawHeading);
  //> Conditional branch.
  if (!heading) return null;
  //> Conditional branch.
  if (heading.includes("execution prompt") || heading.includes("prompt to execute")) {
    //> Return a value.
    return "executionPrompt";
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (
    //> Source statement or expression.
    heading.includes("scope / non-goals") ||
    //> Source statement or expression.
    heading.includes("scope/non-goals") ||
    //> Source statement or expression.
    (heading.includes("scope") && heading.includes("non-goal"))
  //> Source statement or expression.
  ) {
    //> Return a value.
    return "scopeNonGoals";
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (heading === "scope") return "scope";
  //> Conditional branch.
  if (heading.includes("non-goal")) return "nonGoals";
  //> Conditional branch.
  if (heading.includes("objective")) return "objective";
  //> Conditional branch.
  if (heading.includes("constraint")) return "constraints";
  //> Conditional branch.
  if (heading.includes("acceptance checks") || heading.includes("acceptance criteria")) {
    //> Return a value.
    return "acceptanceChecks";
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (
    //> Source statement or expression.
    heading.includes("delivery artifact") ||
    //> Source statement or expression.
    heading.includes("delivery artefact") ||
    //> Source statement or expression.
    heading.includes("deliverable")
  //> Source statement or expression.
  ) {
    //> Return a value.
    return "deliveryArtifact";
  //> Brace or statement terminator.
  }
  //> Return a value.
  return null;
//> Brace or statement terminator.
}

//> Function declaration.
function stripMarkdownNoise(content: string) {
  //> Return a value.
  return content
    //> Source statement or expression.
    .replace(/`[^`]*`/g, " ")
    //> Source statement or expression.
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    //> Source statement or expression.
    .replace(/^\s*[-*]\s+/gm, "")
    //> Source statement or expression.
    .replace(/\s+/g, " ")
    //> Source statement or expression.
    .trim();
//> Brace or statement terminator.
}

//> Function declaration.
function looksPlaceholder(content: string) {
  //> Variable declaration.
  const lowered = content.toLowerCase();
  //> Return a value.
  return (
    //> Source statement or expression.
    lowered.includes("tbd") ||
    //> Source statement or expression.
    lowered.includes("todo") ||
    //> Source statement or expression.
    lowered.includes("placeholder") ||
    //> Source statement or expression.
    lowered.includes("<fill") ||
    //> Source statement or expression.
    lowered.includes("<todo") ||
    //> Source statement or expression.
    lowered.includes("...") ||
    //> Source statement or expression.
    lowered === "n/a"
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Function declaration.
function hasSubstance(content: string, minLen: number) {
  //> Variable declaration.
  const clean = stripMarkdownNoise(content);
  //> Return a value.
  return clean.length >= minLen && !looksPlaceholder(clean);
//> Brace or statement terminator.
}

//> Function declaration.
function hasAcceptanceChecklist(content: string) {
  //> Return a value.
  return /(^|\n)\s*[-*]\s+(\[[ xX]\]\s+)?\S+/.test(content);
//> Brace or statement terminator.
}

//> Export declaration.
export function validateExecutablePromptPackage(body: string | null | undefined) {
  //> Variable declaration.
  const markdown = String(body || "");
  //> Variable declaration.
  const matches = Array.from(markdown.matchAll(HEADING_RE)).map((m) => ({
    //> Source statement or expression.
    heading: m[2] || "",
    //> Source statement or expression.
    index: m.index ?? 0,
    //> Source statement or expression.
    full: m[0] || ""
  //> Delimiter or separator.
  }));

  //> Variable declaration.
  const sections: Record<ExecutablePromptSectionKey, string> = {
    //> Source statement or expression.
    objective: "",
    //> Source statement or expression.
    executionPrompt: "",
    //> Source statement or expression.
    scopeNonGoals: "",
    //> Source statement or expression.
    scope: "",
    //> Source statement or expression.
    nonGoals: "",
    //> Source statement or expression.
    constraints: "",
    //> Source statement or expression.
    acceptanceChecks: "",
    //> Source statement or expression.
    deliveryArtifact: ""
  //> Brace or statement terminator.
  };

  //> For-loop header.
  for (let i = 0; i < matches.length; i += 1) {
    //> Variable declaration.
    const current = matches[i];
    //> Variable declaration.
    const next = matches[i + 1];
    //> Variable declaration.
    const start = current.index + current.full.length;
    //> Variable declaration.
    const end = next ? next.index : markdown.length;
    //> Variable declaration.
    const key = classifyHeading(current.heading);
    //> Conditional branch.
    if (!key) continue;
    //> Variable declaration.
    const content = markdown.slice(start, end).trim();
    //> Conditional branch.
    if (!content) continue;
    //> Source statement or expression.
    sections[key] = sections[key] ? `${sections[key]}\n\n${content}` : content;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const missingSections: string[] = [];
  //> Variable declaration.
  const weakSections: string[] = [];

  //> Conditional branch.
  if (!hasSubstance(sections.objective, 15)) {
    //> Source statement or expression.
    missingSections.push("Objective");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!hasSubstance(sections.executionPrompt, 30)) {
    //> Source statement or expression.
    missingSections.push("Execution Prompt");
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const hasCombinedScope = hasSubstance(sections.scopeNonGoals, 20);
  //> Variable declaration.
  const hasSplitScope = hasSubstance(sections.scope, 10) && hasSubstance(sections.nonGoals, 10);
  //> Conditional branch.
  if (!hasCombinedScope && !hasSplitScope) {
    //> Source statement or expression.
    missingSections.push("Scope / Non-goals");
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (!hasSubstance(sections.constraints, 15)) {
    //> Source statement or expression.
    missingSections.push("Constraints");
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (!hasSubstance(sections.acceptanceChecks, 15)) {
    //> Source statement or expression.
    missingSections.push("Acceptance Checks");
  //> Source statement or expression.
  } else if (!hasAcceptanceChecklist(sections.acceptanceChecks)) {
    //> Source statement or expression.
    weakSections.push("Acceptance Checks (must contain checklist/bullets)");
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (!hasSubstance(sections.deliveryArtifact, 10)) {
    //> Source statement or expression.
    missingSections.push("Delivery Artifact");
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    valid: missingSections.length === 0 && weakSections.length === 0,
    //> Source statement or expression.
    missingSections,
    //> Source statement or expression.
    weakSections,
    //> Source statement or expression.
    sections
  //> Source statement or expression.
  } satisfies ExecutablePromptValidation;
//> Brace or statement terminator.
}

//> Export declaration.
export function promptPackageMissingSummary(result: ExecutablePromptValidation) {
  //> Conditional branch.
  if (result.valid) return "";
  //> Variable declaration.
  const requiredLabels = REQUIRED_SECTION_LABELS.map((entry) => entry.label).join(", ");
  //> Variable declaration.
  const missing = result.missingSections.length
    //> Source statement or expression.
    ? `Missing: ${result.missingSections.join(", ")}.`
    //> Source statement or expression.
    : "";
  //> Variable declaration.
  const weak = result.weakSections.length ? ` Weak: ${result.weakSections.join(", ")}.` : "";
  //> Return a value.
  return `Executable Prompt Package is incomplete. ${missing}${weak} Required sections: ${requiredLabels}.`;
//> Brace or statement terminator.
}
