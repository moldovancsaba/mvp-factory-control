/**
 * `GET` JSON snapshot of orchestrator lease + alpha locks + queue health (`getOrchestratorIntrospectionSnapshot`). Session required.
 */
//> Import bindings from a module.
import { NextResponse } from "next/server";
//> Import bindings from a module.
import { getServerSession } from "next-auth";
//> Import bindings from a module.
import { authOptions } from "@/lib/auth";
//> Import bindings from a module.
import { getOrchestratorIntrospectionSnapshot } from "@/lib/orchestrator-introspection";

//> Export declaration.
export async function GET() {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) {
    //> Return a value.
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  //> Brace or statement terminator.
  }

  //> Try block start.
  try {
    //> Variable declaration.
    const snapshot = await getOrchestratorIntrospectionSnapshot();
    //> Return a value.
    return NextResponse.json(snapshot, { status: 200 });
  //> Source statement or expression.
  } catch (error) {
    //> Variable declaration.
    const message = error instanceof Error ? error.message : String(error);
    //> Return a value.
    return NextResponse.json(
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        error: "Failed to load orchestrator introspection snapshot.",
        //> Source statement or expression.
        message
      //> Brace or statement terminator.
      },
      //> Source statement or expression.
      { status: 500 }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}
