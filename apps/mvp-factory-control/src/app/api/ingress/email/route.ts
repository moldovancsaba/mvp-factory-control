/**
 * **Email ingress** webhook: `POST` JSON payloads to `handleInboundEmail`. Auth via shared token env/header (optional if unset).
 *
 * Token: `MVP_FACTORY_CONTROL_EMAIL_INGRESS_TOKEN` matched against `x-mvp-factory-control-ingress-token` or `Authorization: Bearer`.
 */
//> Import bindings from a module.
import { NextRequest, NextResponse } from "next/server";
//> Import bindings from a module.
import { handleInboundEmail } from "@/lib/email-ingress";

//> Function declaration.
function readBearerToken(value: string | null) {
  //> Conditional branch.
  if (!value) return null;
  //> Variable declaration.
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  //> Return a value.
  return match ? match[1].trim() : null;
//> Brace or statement terminator.
}

//> Function declaration.
function isIngressAuthorized(req: NextRequest) {
  //> Variable declaration.
  const expected = String(process.env.MVP_FACTORY_CONTROL_EMAIL_INGRESS_TOKEN || "").trim();
  //> Conditional branch.
  if (!expected) return true;
  //> Variable declaration.
  const headerToken =
    //> Source statement or expression.
    req.headers.get("x-mvp-factory-control-ingress-token") ||
    //> Source statement or expression.
    readBearerToken(req.headers.get("authorization")) ||
    //> String literal line.
    "";
  //> Return a value.
  return String(headerToken).trim() === expected;
//> Brace or statement terminator.
}

//> Export declaration.
export async function POST(req: NextRequest) {
  //> Conditional branch.
  if (!isIngressAuthorized(req)) {
    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        error: "Unauthorized email ingress token."
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: 401 }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  let payload: unknown;
  //> Try block start.
  try {
    //> Source statement or expression.
    payload = await req.json();
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        error: "Invalid JSON payload."
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: 400 }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Try block start.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //> Variable declaration.
    const result = await handleInboundEmail(payload as any);
    //> Variable declaration.
    const statusCode =
      //> Source statement or expression.
      result.status === "ENQUEUED"
        //> Source statement or expression.
        ? 202
        //> Source statement or expression.
        : result.status === "BLOCKED"
        //> Source statement or expression.
        ? 403
        //> Source statement or expression.
        : result.status === "DEAD_LETTER"
        //> Source statement or expression.
        ? 422
        //> Source statement or expression.
        : 200;
    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        ok: result.accepted,
        //> Source statement or expression.
        status: result.status,
        //> Source statement or expression.
        eventId: result.eventId,
        //> Source statement or expression.
        threadId: result.threadId ?? null,
        //> Source statement or expression.
        taskId: result.taskId ?? null,
        //> Source statement or expression.
        reason: result.reason
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: statusCode }
    //> Delimiter or separator.
    );
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Variable declaration.
    const status = /unsupported external ingress channel/i.test(message) ? 400 : 500;
    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        ok: false,
        //> Source statement or expression.
        error: message
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}
