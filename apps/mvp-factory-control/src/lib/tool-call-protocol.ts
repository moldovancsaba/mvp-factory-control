/**
 * Structured **tool call protocol** envelope (versioned): validation, normalization, and summaries.
 *
 * Defines allowed tool name/id patterns, risk classes, approval requirements, and expected artifacts.
 * Used when persisting tool plans on tasks and when evaluating command policy. Protocol name/major exported
 * for compatibility checks across workers and UI.
 */
//> Variable declaration.
const TOOL_CALL_NAME_RE = /^[a-z][a-z0-9_.-]{1,63}$/;
//> Variable declaration.
const TOOL_CALL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
//> Variable declaration.
const SUPPORTED_RISK_CLASS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
//> Variable declaration.
const SUPPORTED_APPROVAL = new Set(["NONE", "HUMAN_APPROVAL"]);
//> Variable declaration.
const SUPPORTED_MODE = new Set(["SEQUENTIAL", "PARALLEL"]);
//> Variable declaration.
const SUPPORTED_ARTIFACT_KIND = new Set(["LOG", "FILE", "PATCH", "ISSUE_COMMENT", "PR"]);

//> Export declaration.
export const TOOL_CALL_PROTOCOL_NAME = "mvp-factory-control.tool-call";
//> Export declaration.
export const TOOL_CALL_PROTOCOL_SUPPORTED_MAJOR = 1;
//> Export declaration.
export const TOOL_CALL_PROTOCOL_V1 = "1.0";

//> Export declaration.
export type ToolCallRiskClass = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
//> Export declaration.
export type ToolCallApprovalRequirement = "NONE" | "HUMAN_APPROVAL";
//> Export declaration.
export type ToolCallMode = "SEQUENTIAL" | "PARALLEL";
//> Export declaration.
export type ToolCallExpectedArtifactKind = "LOG" | "FILE" | "PATCH" | "ISSUE_COMMENT" | "PR";

//> Export declaration.
export type ToolCallExpectedArtifact = {
  //> Source statement or expression.
  kind: ToolCallExpectedArtifactKind;
  //> Source statement or expression.
  path: string | null;
  //> Source statement or expression.
  description: string | null;
  //> Source statement or expression.
  required: boolean;
//> Brace or statement terminator.
};

//> Export declaration.
export type ToolCallDefinition = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  tool: string;
  //> Source statement or expression.
  args: Record<string, unknown>;
  //> Source statement or expression.
  riskClass: ToolCallRiskClass;
  //> Source statement or expression.
  approval: ToolCallApprovalRequirement;
  //> Source statement or expression.
  expectedArtifacts: ToolCallExpectedArtifact[];
//> Brace or statement terminator.
};

//> Export declaration.
export type ToolCallProtocolEnvelope = {
  //> Source statement or expression.
  protocol: typeof TOOL_CALL_PROTOCOL_NAME;
  //> Source statement or expression.
  version: string;
  //> Source statement or expression.
  mode: ToolCallMode;
  //> Source statement or expression.
  calls: ToolCallDefinition[];
//> Brace or statement terminator.
};

//> Type or interface definition.
type ValidationFailureCode =
  //> Source statement or expression.
  | "INVALID_TYPE"
  //> Source statement or expression.
  | "INVALID_PROTOCOL"
  //> Source statement or expression.
  | "INVALID_VERSION"
  //> Source statement or expression.
  | "INVALID_MODE"
  //> Source statement or expression.
  | "INVALID_CALLS"
  //> Source statement or expression.
  | "INVALID_CALL";

//> Export declaration.
export type ToolCallProtocolValidationResult =
  //> Source statement or expression.
  | {
      //> Source statement or expression.
      present: false;
      //> Source statement or expression.
      ok: true;
      //> Source statement or expression.
      reason: "No tool-call protocol payload provided.";
    //> Brace or statement terminator.
    }
  //> Source statement or expression.
  | {
      //> Source statement or expression.
      present: true;
      //> Source statement or expression.
      ok: false;
      //> Source statement or expression.
      code: ValidationFailureCode;
      //> Source statement or expression.
      reason: string;
    //> Brace or statement terminator.
    }
  //> Source statement or expression.
  | {
      //> Source statement or expression.
      present: true;
      //> Source statement or expression.
      ok: true;
      //> Source statement or expression.
      reason: "Tool-call protocol payload is valid.";
      //> Source statement or expression.
      envelope: ToolCallProtocolEnvelope;
    //> Brace or statement terminator.
    };

//> Export declaration.
export type ToolCallCommandParseResult =
  //> Source statement or expression.
  | { kind: "none" }
  //> Source statement or expression.
  | { kind: "invalid"; reason: string }
  //> Source statement or expression.
  | {
      //> Source statement or expression.
      kind: "tool_call";
      //> Source statement or expression.
      envelopeInput: unknown;
      //> Source statement or expression.
      approvalToken: string | null;
      //> Source statement or expression.
      dryRun: boolean;
      //> Source statement or expression.
      title: string;
    //> Brace or statement terminator.
    };

//> Export declaration.
export type ToolCallApprovalCommandParseResult =
  //> Source statement or expression.
  | { kind: "none" }
  //> Source statement or expression.
  | { kind: "invalid"; reason: string }
  //> Source statement or expression.
  | {
      //> Source statement or expression.
      kind: "approve_tool_call";
      //> Source statement or expression.
      envelopeInput: unknown;
      //> Source statement or expression.
      ttlSeconds: number | null;
    //> Brace or statement terminator.
    };

//> Function declaration.
function asRecord(value: unknown): Record<string, unknown> | null {
  //> Conditional branch.
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  //> Return a value.
  return value as Record<string, unknown>;
//> Brace or statement terminator.
}

//> Function declaration.
function asTrimmed(value: unknown): string {
  //> Return a value.
  return typeof value === "string" ? value.trim() : "";
//> Brace or statement terminator.
}

//> Function declaration.
function parseVersion(value: string): { major: number; minor: number } | null {
  //> Variable declaration.
  const match = /^(\d+)\.(\d+)$/.exec(value);
  //> Conditional branch.
  if (!match) return null;
  //> Return a value.
  return {
    //> Source statement or expression.
    major: Number.parseInt(match[1], 10),
    //> Source statement or expression.
    minor: Number.parseInt(match[2], 10)
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function parseExpectedArtifacts(
  //> Source statement or expression.
  value: unknown,
  //> Source statement or expression.
  callIndex: number
//> Source statement or expression.
): { ok: true; value: ToolCallExpectedArtifact[] } | { ok: false; reason: string } {
  //> Conditional branch.
  if (value == null) return { ok: true, value: [] };
  //> Conditional branch.
  if (!Array.isArray(value)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      reason: `toolCallProtocol.calls[${callIndex}].expectedArtifacts must be an array when provided.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (value.length > 25) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      reason: `toolCallProtocol.calls[${callIndex}].expectedArtifacts must contain at most 25 items.`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const normalized: ToolCallExpectedArtifact[] = [];
  //> For-loop header.
  for (let i = 0; i < value.length; i += 1) {
    //> Variable declaration.
    const raw = asRecord(value[i]);
    //> Conditional branch.
    if (!raw) {
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        reason: `toolCallProtocol.calls[${callIndex}].expectedArtifacts[${i}] must be an object.`
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const kindRaw = asTrimmed(raw.kind).toUpperCase();
    //> Conditional branch.
    if (!SUPPORTED_ARTIFACT_KIND.has(kindRaw)) {
      //> Return a value.
      return {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        reason:
          //> String literal line.
          `toolCallProtocol.calls[${callIndex}].expectedArtifacts[${i}].kind must be one of: ` +
          //> String literal line.
          "LOG, FILE, PATCH, ISSUE_COMMENT, PR."
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const pathRaw = asTrimmed(raw.path);
    //> Variable declaration.
    const descriptionRaw = asTrimmed(raw.description);
    //> Source statement or expression.
    normalized.push({
      //> Source statement or expression.
      kind: kindRaw as ToolCallExpectedArtifactKind,
      //> Source statement or expression.
      path: pathRaw || null,
      //> Source statement or expression.
      description: descriptionRaw || null,
      //> Source statement or expression.
      required: Boolean(raw.required)
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }
  //> Return a value.
  return { ok: true, value: normalized };
//> Brace or statement terminator.
}

//> Export declaration.
export function validateToolCallProtocolEnvelope(input: unknown): ToolCallProtocolValidationResult {
  //> Conditional branch.
  if (input == null) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: false,
      //> Source statement or expression.
      ok: true,
      //> Source statement or expression.
      reason: "No tool-call protocol payload provided."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const record = asRecord(input);
  //> Conditional branch.
  if (!record) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: true,
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "INVALID_TYPE",
      //> Source statement or expression.
      reason: "toolCallProtocol must be a JSON object."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const protocol = asTrimmed(record.protocol);
  //> Conditional branch.
  if (protocol !== TOOL_CALL_PROTOCOL_NAME) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: true,
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "INVALID_PROTOCOL",
      //> Source statement or expression.
      reason: `toolCallProtocol.protocol must be exactly \"${TOOL_CALL_PROTOCOL_NAME}\".`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const version = asTrimmed(record.version);
  //> Variable declaration.
  const parsedVersion = parseVersion(version);
  //> Conditional branch.
  if (!parsedVersion || parsedVersion.major !== TOOL_CALL_PROTOCOL_SUPPORTED_MAJOR) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: true,
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "INVALID_VERSION",
      //> Source statement or expression.
      reason: `toolCallProtocol.version must be ${TOOL_CALL_PROTOCOL_SUPPORTED_MAJOR}.x (for example \"${TOOL_CALL_PROTOCOL_V1}\").`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const modeRaw = asTrimmed(record.mode).toUpperCase();
  //> Const with function or expression.
  const mode = (modeRaw || "SEQUENTIAL") as ToolCallMode;
  //> Conditional branch.
  if (!SUPPORTED_MODE.has(mode)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: true,
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "INVALID_MODE",
      //> Source statement or expression.
      reason: "toolCallProtocol.mode must be SEQUENTIAL or PARALLEL."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (!Array.isArray(record.calls)) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: true,
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "INVALID_CALLS",
      //> Source statement or expression.
      reason: "toolCallProtocol.calls must be an array."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!record.calls.length) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: true,
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "INVALID_CALLS",
      //> Source statement or expression.
      reason: "toolCallProtocol.calls must contain at least one call."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (record.calls.length > 20) {
    //> Return a value.
    return {
      //> Source statement or expression.
      present: true,
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "INVALID_CALLS",
      //> Source statement or expression.
      reason: "toolCallProtocol.calls must contain at most 20 calls."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const normalizedCalls: ToolCallDefinition[] = [];
  //> For-loop header.
  for (let i = 0; i < record.calls.length; i += 1) {
    //> Variable declaration.
    const rawCall = asRecord(record.calls[i]);
    //> Conditional branch.
    if (!rawCall) {
      //> Return a value.
      return {
        //> Source statement or expression.
        present: true,
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "INVALID_CALL",
        //> Source statement or expression.
        reason: `toolCallProtocol.calls[${i}] must be an object.`
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const id = asTrimmed(rawCall.id);
    //> Conditional branch.
    if (!id || !TOOL_CALL_ID_RE.test(id)) {
      //> Return a value.
      return {
        //> Source statement or expression.
        present: true,
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "INVALID_CALL",
        //> Source statement or expression.
        reason:
          //> String literal line.
          `toolCallProtocol.calls[${i}].id is required and must match ` +
          //> String literal line.
          "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$."
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const tool = asTrimmed(rawCall.tool);
    //> Conditional branch.
    if (!tool || !TOOL_CALL_NAME_RE.test(tool)) {
      //> Return a value.
      return {
        //> Source statement or expression.
        present: true,
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "INVALID_CALL",
        //> Source statement or expression.
        reason:
          //> String literal line.
          `toolCallProtocol.calls[${i}].tool is required and must match ` +
          //> String literal line.
          "^[a-z][a-z0-9_.-]{1,63}$."
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const args = asRecord(rawCall.args);
    //> Conditional branch.
    if (!args) {
      //> Return a value.
      return {
        //> Source statement or expression.
        present: true,
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "INVALID_CALL",
        //> Source statement or expression.
        reason: `toolCallProtocol.calls[${i}].args must be an object.`
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const riskClassRaw = asTrimmed(rawCall.riskClass).toUpperCase();
    //> Conditional branch.
    if (!SUPPORTED_RISK_CLASS.has(riskClassRaw)) {
      //> Return a value.
      return {
        //> Source statement or expression.
        present: true,
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "INVALID_CALL",
        //> Source statement or expression.
        reason:
          //> String literal line.
          `toolCallProtocol.calls[${i}].riskClass must be one of: ` +
          //> String literal line.
          "LOW, MEDIUM, HIGH, CRITICAL."
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const approvalRaw = asTrimmed(rawCall.approval).toUpperCase();
    //> Const with function or expression.
    const approval = (approvalRaw || "NONE") as ToolCallApprovalRequirement;
    //> Conditional branch.
    if (!SUPPORTED_APPROVAL.has(approval)) {
      //> Return a value.
      return {
        //> Source statement or expression.
        present: true,
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "INVALID_CALL",
        //> Source statement or expression.
        reason:
          //> String literal line.
          `toolCallProtocol.calls[${i}].approval must be one of: ` +
          //> String literal line.
          "NONE, HUMAN_APPROVAL."
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Variable declaration.
    const artifactParse = parseExpectedArtifacts(rawCall.expectedArtifacts, i);
    //> Conditional branch.
    if (!artifactParse.ok) {
      //> Return a value.
      return {
        //> Source statement or expression.
        present: true,
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        code: "INVALID_CALL",
        //> Source statement or expression.
        reason: artifactParse.reason
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    }

    //> Source statement or expression.
    normalizedCalls.push({
      //> Source statement or expression.
      id,
      //> Source statement or expression.
      tool,
      //> Source statement or expression.
      args,
      //> Source statement or expression.
      riskClass: riskClassRaw as ToolCallRiskClass,
      //> Source statement or expression.
      approval,
      //> Source statement or expression.
      expectedArtifacts: artifactParse.value
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    present: true,
    //> Source statement or expression.
    ok: true,
    //> Source statement or expression.
    reason: "Tool-call protocol payload is valid.",
    //> Source statement or expression.
    envelope: {
      //> Source statement or expression.
      protocol: TOOL_CALL_PROTOCOL_NAME,
      //> Source statement or expression.
      version,
      //> Source statement or expression.
      mode,
      //> Source statement or expression.
      calls: normalizedCalls
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export function summarizeToolCallProtocolEnvelope(envelope: ToolCallProtocolEnvelope) {
  //> Return a value.
  return {
    //> Source statement or expression.
    protocol: envelope.protocol,
    //> Source statement or expression.
    version: envelope.version,
    //> Source statement or expression.
    mode: envelope.mode,
    //> Source statement or expression.
    callCount: envelope.calls.length,
    //> Source statement or expression.
    calls: envelope.calls.map((call) => ({
      //> Source statement or expression.
      id: call.id,
      //> Source statement or expression.
      tool: call.tool,
      //> Source statement or expression.
      riskClass: call.riskClass,
      //> Source statement or expression.
      approval: call.approval,
      //> Source statement or expression.
      expectedArtifactCount: call.expectedArtifacts.length
    //> Delimiter or separator.
    }))
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function unwrapJsonFence(value: string) {
  //> Variable declaration.
  const trimmed = value.trim();
  //> Variable declaration.
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  //> Conditional branch.
  if (!match) return trimmed;
  //> Return a value.
  return match[1].trim();
//> Brace or statement terminator.
}

//> Function declaration.
function parseJsonSuffix(command: string, prefix: RegExp) {
  //> Variable declaration.
  const trimmed = command.trim();
  //> Variable declaration.
  const withoutPrefix = trimmed.replace(prefix, "").trim();
  //> Variable declaration.
  const rawJson = unwrapJsonFence(withoutPrefix);
  //> Conditional branch.
  if (!rawJson) return { ok: false as const, reason: "JSON payload is required." };
  //> Try block start.
  try {
    //> Return a value.
    return { ok: true as const, value: JSON.parse(rawJson) as unknown };
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return { ok: false as const, reason: "Payload must be valid JSON." };
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Export declaration.
export function parseToolCallCommand(command: string): ToolCallCommandParseResult {
  //> Variable declaration.
  const trimmed = command.trim();
  //> Conditional branch.
  if (!/^tool-call\b/i.test(trimmed)) {
    //> Return a value.
    return { kind: "none" };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const parsedSuffix = parseJsonSuffix(trimmed, /^tool-call\b/i);
  //> Conditional branch.
  if (!parsedSuffix.ok) {
    //> Return a value.
    return {
      //> Source statement or expression.
      kind: "invalid",
      //> Source statement or expression.
      reason:
        //> Source statement or expression.
        parsedSuffix.reason === "JSON payload is required."
          //> Source statement or expression.
          ? "tool-call command requires a JSON payload after the prefix."
          //> Source statement or expression.
          : "tool-call command payload must be valid JSON."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const parsedRecord = asRecord(parsedSuffix.value);
  //> Variable declaration.
  let envelopeInput: unknown = parsedSuffix.value;
  //> Variable declaration.
  let approvalToken: string | null = null;
  //> Variable declaration.
  let dryRun = false;
  //> Conditional branch.
  if (parsedRecord) {
    //> Conditional branch.
    if (parsedRecord.toolCallProtocol != null) {
      //> Source statement or expression.
      envelopeInput = parsedRecord.toolCallProtocol;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const approvalTokenRaw = asTrimmed(parsedRecord.approvalToken);
    //> Source statement or expression.
    approvalToken = approvalTokenRaw || null;
    //> Conditional branch.
    if (typeof parsedRecord.dryRun === "boolean") {
      //> Source statement or expression.
      dryRun = parsedRecord.dryRun;
    //> Source statement or expression.
    } else {
      //> Variable declaration.
      const policy = asRecord(parsedRecord.toolCallPolicy);
      //> Source statement or expression.
      dryRun = Boolean(policy?.dryRun);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    kind: "tool_call",
    //> Source statement or expression.
    envelopeInput,
    //> Source statement or expression.
    approvalToken,
    //> Source statement or expression.
    dryRun,
    //> Source statement or expression.
    title: "Execute structured tool-call payload."
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export function parseToolCallApprovalRequestCommand(
  //> Source statement or expression.
  command: string
//> Source statement or expression.
): ToolCallApprovalCommandParseResult {
  //> Variable declaration.
  const trimmed = command.trim();
  //> Conditional branch.
  if (!/^approve-tool-call\b/i.test(trimmed)) {
    //> Return a value.
    return { kind: "none" };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const parsedSuffix = parseJsonSuffix(trimmed, /^approve-tool-call\b/i);
  //> Conditional branch.
  if (!parsedSuffix.ok) {
    //> Return a value.
    return {
      //> Source statement or expression.
      kind: "invalid",
      //> Source statement or expression.
      reason:
        //> Source statement or expression.
        parsedSuffix.reason === "JSON payload is required."
          //> Source statement or expression.
          ? "approve-tool-call command requires a JSON payload after the prefix."
          //> Source statement or expression.
          : "approve-tool-call payload must be valid JSON."
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const parsedRecord = asRecord(parsedSuffix.value);
  //> Variable declaration.
  let envelopeInput: unknown = parsedSuffix.value;
  //> Variable declaration.
  let ttlSeconds: number | null = null;
  //> Conditional branch.
  if (parsedRecord) {
    //> Conditional branch.
    if (parsedRecord.toolCallProtocol != null) {
      //> Source statement or expression.
      envelopeInput = parsedRecord.toolCallProtocol;
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (typeof parsedRecord.ttlSeconds === "number" && Number.isFinite(parsedRecord.ttlSeconds)) {
      //> Source statement or expression.
      ttlSeconds = Math.min(Math.max(Math.trunc(parsedRecord.ttlSeconds), 30), 3600);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    kind: "approve_tool_call",
    //> Source statement or expression.
    envelopeInput,
    //> Source statement or expression.
    ttlSeconds
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}
