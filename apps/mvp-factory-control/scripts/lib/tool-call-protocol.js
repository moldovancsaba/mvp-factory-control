/**
 * CommonJS port of `src/lib/tool-call-protocol.ts` for the Node worker. Keep validation rules in sync.
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

//> Variable declaration.
const TOOL_CALL_PROTOCOL_NAME = "mvp-factory-control.tool-call";
//> Variable declaration.
const TOOL_CALL_PROTOCOL_SUPPORTED_MAJOR = 1;
//> Variable declaration.
const TOOL_CALL_PROTOCOL_V1 = "1.0";

//> Function declaration.
function asRecord(value) {
  //> Conditional branch.
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  //> Return a value.
  return value;
//> Brace or statement terminator.
}

//> Function declaration.
function asTrimmed(value) {
  //> Return a value.
  return typeof value === "string" ? value.trim() : "";
//> Brace or statement terminator.
}

//> Function declaration.
function parseVersion(value) {
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
function parseExpectedArtifacts(value, callIndex) {
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
  const normalized = [];
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
    const path = asTrimmed(raw.path);
    //> Variable declaration.
    const description = asTrimmed(raw.description);
    //> Source statement or expression.
    normalized.push({
      //> Source statement or expression.
      kind: kindRaw,
      //> Source statement or expression.
      path: path || null,
      //> Source statement or expression.
      description: description || null,
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

//> Function declaration.
function validateToolCallProtocolEnvelope(input) {
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
      reason: `toolCallProtocol.protocol must be exactly "${TOOL_CALL_PROTOCOL_NAME}".`
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
      reason: `toolCallProtocol.version must be ${TOOL_CALL_PROTOCOL_SUPPORTED_MAJOR}.x (for example "${TOOL_CALL_PROTOCOL_V1}").`
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const modeRaw = asTrimmed(record.mode).toUpperCase();
  //> Variable declaration.
  const mode = modeRaw || "SEQUENTIAL";
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
  const normalizedCalls = [];
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
    //> Variable declaration.
    const approval = approvalRaw || "NONE";
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
      riskClass: riskClassRaw,
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

//> Function declaration.
function summarizeToolCallProtocolEnvelope(envelope) {
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
      expectedArtifactCount: Array.isArray(call.expectedArtifacts)
        //> Source statement or expression.
        ? call.expectedArtifacts.length
        //> Source statement or expression.
        : 0
    //> Delimiter or separator.
    }))
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Source statement or expression.
module.exports = {
  //> Source statement or expression.
  TOOL_CALL_PROTOCOL_NAME,
  //> Source statement or expression.
  TOOL_CALL_PROTOCOL_SUPPORTED_MAJOR,
  //> Source statement or expression.
  TOOL_CALL_PROTOCOL_V1,
  //> Source statement or expression.
  validateToolCallProtocolEnvelope,
  //> Source statement or expression.
  summarizeToolCallProtocolEnvelope
//> Brace or statement terminator.
};
