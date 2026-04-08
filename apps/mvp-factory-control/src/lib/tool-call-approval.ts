/**
 * HMAC-signed, time-limited **approval tokens** for high-risk tool execution (War Room tool approval).
 *
 * Payload includes approver id/email, action fingerprint, expiry. Verified with `MVP_FACTORY_CONTROL_TOOL_APPROVAL_SECRET`
 * (or dev fallback). Token prefix `TOKEN_PREFIX` identifies format version in wire strings.
 */
//> Import bindings from a module.
import crypto from "node:crypto";
//> Import bindings from a module.
import type { ToolCallProtocolEnvelope } from "@/lib/tool-call-protocol";

//> Variable declaration.
const TOKEN_PREFIX = "wrtoa1";
//> Variable declaration.
const DEFAULT_TTL_SECONDS = 10 * 60;

//> Type or interface definition.
type TokenPayload = {
  //> Source statement or expression.
  v: 1;
  //> Source statement or expression.
  tokenId: string;
  //> Source statement or expression.
  approverUserId: string;
  //> Source statement or expression.
  approverEmail: string | null;
  //> Source statement or expression.
  actionFingerprint: string;
  //> Source statement or expression.
  issuedAt: string;
  //> Source statement or expression.
  expiresAt: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type CreateToolCallApprovalTokenParams = {
  //> Source statement or expression.
  approverUserId: string;
  //> Source statement or expression.
  approverEmail?: string | null;
  //> Source statement or expression.
  actionFingerprint: string;
  //> Source statement or expression.
  ttlSeconds?: number;
  //> Source statement or expression.
  now?: Date;
  //> Source statement or expression.
  secret?: string;
//> Brace or statement terminator.
};

//> Export declaration.
export type VerifyToolCallApprovalTokenResult =
  //> Source statement or expression.
  | { ok: true; payload: TokenPayload }
  //> Source statement or expression.
  | { ok: false; code: string; reason: string; tokenId: string | null };

//> Function declaration.
function readSecret(explicit?: string): string {
  //> Variable declaration.
  const secret =
    //> Source statement or expression.
    (explicit || process.env.MVP_FACTORY_CONTROL_TOOL_APPROVAL_SECRET || process.env.NEXTAUTH_SECRET || "")
      //> Source statement or expression.
      .trim();
  //> Conditional branch.
  if (!secret) {
    //> Throw error.
    throw new Error(
      //> String literal line.
      "Tool approval secret is not configured. Set MVP_FACTORY_CONTROL_TOOL_APPROVAL_SECRET (or NEXTAUTH_SECRET)."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return secret;
//> Brace or statement terminator.
}

//> Function declaration.
function base64UrlEncode(input: Buffer | string): string {
  //> Return a value.
  return Buffer.from(input)
    //> Source statement or expression.
    .toString("base64")
    //> Source statement or expression.
    .replace(/\+/g, "-")
    //> Source statement or expression.
    .replace(/\//g, "_")
    //> Source statement or expression.
    .replace(/=+$/g, "");
//> Brace or statement terminator.
}

//> Function declaration.
function base64UrlDecode(input: string): Buffer {
  //> Variable declaration.
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  //> Variable declaration.
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  //> Return a value.
  return Buffer.from(padded, "base64");
//> Brace or statement terminator.
}

//> Function declaration.
function stableJson(value: unknown): string {
  //> Conditional branch.
  if (value == null) return "null";
  //> Conditional branch.
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  //> Conditional branch.
  if (typeof value === "string") return JSON.stringify(value);
  //> Conditional branch.
  if (Array.isArray(value)) {
    //> Return a value.
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (typeof value === "object") {
    //> Variable declaration.
    const record = value as Record<string, unknown>;
    //> Variable declaration.
    const keys = Object.keys(record).sort();
    //> Return a value.
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return JSON.stringify(String(value));
//> Brace or statement terminator.
}

//> Function declaration.
function signPayload(payloadPart: string, secret: string) {
  //> Return a value.
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payloadPart).digest());
//> Brace or statement terminator.
}

//> Export declaration.
export function buildToolCallActionFingerprint(envelope: ToolCallProtocolEnvelope) {
  //> Variable declaration.
  const canonical = {
    //> Source statement or expression.
    protocol: envelope.protocol,
    //> Source statement or expression.
    version: envelope.version,
    //> Source statement or expression.
    mode: envelope.mode,
    //> Source statement or expression.
    calls: envelope.calls.map((call) => ({
      //> Source statement or expression.
      id: call.id,
      //> Source statement or expression.
      tool: call.tool,
      //> Source statement or expression.
      args: call.args,
      //> Source statement or expression.
      riskClass: call.riskClass,
      //> Source statement or expression.
      approval: call.approval,
      //> Source statement or expression.
      expectedArtifacts: call.expectedArtifacts
    //> Delimiter or separator.
    }))
  //> Brace or statement terminator.
  };
  //> Return a value.
  return crypto.createHash("sha256").update(stableJson(canonical)).digest("hex");
//> Brace or statement terminator.
}

//> Export declaration.
export function createToolCallApprovalToken(params: CreateToolCallApprovalTokenParams) {
  //> Variable declaration.
  const approverUserId = String(params.approverUserId || "").trim();
  //> Variable declaration.
  const actionFingerprint = String(params.actionFingerprint || "").trim();
  //> Conditional branch.
  if (!approverUserId) {
    //> Throw error.
    throw new Error("approverUserId is required for tool-call approval token.");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!actionFingerprint) {
    //> Throw error.
    throw new Error("actionFingerprint is required for tool-call approval token.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const now = params.now ?? new Date();
  //> Variable declaration.
  const ttlSeconds = Math.min(Math.max(Math.trunc(params.ttlSeconds ?? DEFAULT_TTL_SECONDS), 30), 3600);
  //> Variable declaration.
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  //> Variable declaration.
  const payload: TokenPayload = {
    //> Source statement or expression.
    v: 1,
    //> Source statement or expression.
    tokenId: crypto.randomUUID(),
    //> Source statement or expression.
    approverUserId,
    //> Source statement or expression.
    approverEmail: params.approverEmail?.trim() || null,
    //> Source statement or expression.
    actionFingerprint,
    //> Source statement or expression.
    issuedAt: now.toISOString(),
    //> Source statement or expression.
    expiresAt: expiresAt.toISOString()
  //> Brace or statement terminator.
  };
  //> Variable declaration.
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  //> Variable declaration.
  const signature = signPayload(payloadPart, readSecret(params.secret));
  //> Return a value.
  return {
    //> Source statement or expression.
    token: `${TOKEN_PREFIX}.${payloadPart}.${signature}`,
    //> Source statement or expression.
    expiresAt: payload.expiresAt,
    //> Source statement or expression.
    tokenId: payload.tokenId
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export function verifyToolCallApprovalToken(params: {
  //> Source statement or expression.
  token: string;
  //> Source statement or expression.
  expectedActionFingerprint: string;
  //> Source statement or expression.
  now?: Date;
  //> Source statement or expression.
  secret?: string;
//> Source statement or expression.
}): VerifyToolCallApprovalTokenResult {
  //> Variable declaration.
  const token = String(params.token || "").trim();
  //> Conditional branch.
  if (!token) {
    //> Return a value.
    return { ok: false, code: "TOKEN_MISSING", reason: "Approval token is required.", tokenId: null };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const expectedActionFingerprint = String(params.expectedActionFingerprint || "").trim();
  //> Conditional branch.
  if (!expectedActionFingerprint) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "FINGERPRINT_MISSING",
      //> Source statement or expression.
      reason: "Expected action fingerprint is required for approval verification.",
      //> Source statement or expression.
      tokenId: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const parts = token.split(".");
  //> Conditional branch.
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "TOKEN_FORMAT_INVALID",
      //> Source statement or expression.
      reason: "Approval token format is invalid.",
      //> Source statement or expression.
      tokenId: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const payloadPart = parts[1];
  //> Variable declaration.
  const signaturePart = parts[2];
  //> Variable declaration.
  let payload: TokenPayload | null = null;
  //> Try block start.
  try {
    //> Source statement or expression.
    payload = JSON.parse(base64UrlDecode(payloadPart).toString("utf8")) as TokenPayload;
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "TOKEN_PAYLOAD_INVALID",
      //> Source statement or expression.
      reason: "Approval token payload cannot be decoded.",
      //> Source statement or expression.
      tokenId: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!payload || payload.v !== 1 || !payload.tokenId || !payload.approverUserId) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "TOKEN_FIELDS_INVALID",
      //> Source statement or expression.
      reason: "Approval token payload is missing required fields.",
      //> Source statement or expression.
      tokenId: payload?.tokenId || null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const expectedSignature = signPayload(payloadPart, readSecret(params.secret));
  //> Conditional branch.
  if (signaturePart !== expectedSignature) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "TOKEN_SIGNATURE_INVALID",
      //> Source statement or expression.
      reason: "Approval token signature is invalid.",
      //> Source statement or expression.
      tokenId: payload.tokenId
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (payload.actionFingerprint !== expectedActionFingerprint) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "TOKEN_FINGERPRINT_MISMATCH",
      //> Source statement or expression.
      reason: "Approval token does not match the target action fingerprint.",
      //> Source statement or expression.
      tokenId: payload.tokenId
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const now = params.now ?? new Date();
  //> Variable declaration.
  const expiresAtMs = Date.parse(payload.expiresAt);
  //> Conditional branch.
  if (!Number.isFinite(expiresAtMs) || now.getTime() > expiresAtMs) {
    //> Return a value.
    return {
      //> Source statement or expression.
      ok: false,
      //> Source statement or expression.
      code: "TOKEN_EXPIRED",
      //> Source statement or expression.
      reason: "Approval token has expired.",
      //> Source statement or expression.
      tokenId: payload.tokenId
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { ok: true, payload };
//> Brace or statement terminator.
}
