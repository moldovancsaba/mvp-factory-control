/**
 * Role-based access control for server-side operations (email allowlists + default role).
 *
 * Roles: ADMIN, OPERATOR, VIEWER, CLIENT. Resolved from env allowlists:
 * - `MVP_FACTORY_CONTROL_RBAC_ADMIN_EMAILS` (comma/newline/space separated)
 * - `..._OPERATOR_EMAILS`, `..._VIEWER_EMAILS`, `..._CLIENT_EMAILS`
 * - `MVP_FACTORY_CONTROL_RBAC_DEFAULT_ROLE` when email matches no list (default OPERATOR)
 *
 * `requireRbacAccess()` loads the session, resolves role, writes a `lifecycleAuditEvent` row
 * (entityType RBAC), and throws if the role is not in `allowedRoles`.
 */
//> Import bindings from a module.
import type { Prisma } from "@prisma/client";
//> Import bindings from a module.
import { getServerSession } from "next-auth";
//> Import bindings from a module.
import { authOptions } from "@/lib/auth";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";

//> Export declaration.
export type MVPFactoryControlUserRole = "ADMIN" | "OPERATOR" | "VIEWER" | "CLIENT";

//> Export declaration.
export const MVP_FACTORY_CONTROL_USER_ROLES: MVPFactoryControlUserRole[] = [
  //> String literal line.
  "ADMIN",
  //> String literal line.
  "OPERATOR",
  //> String literal line.
  "VIEWER",
  //> String literal line.
  "CLIENT"
//> Delimiter or separator.
];

//> Type or interface definition.
type RequireRbacAccessOptions = {
  //> Source statement or expression.
  action: string;
  //> Source statement or expression.
  allowedRoles: MVPFactoryControlUserRole[];
  //> Source statement or expression.
  entityType?: string;
  //> Source statement or expression.
  entityId?: string | null;
  //> Source statement or expression.
  metadata?: Prisma.JsonObject;
//> Brace or statement terminator.
};

//> Type or interface definition.
type RbacAuthContext = {
  //> Source statement or expression.
  userId: string | null;
  //> Source statement or expression.
  userEmail: string | null;
  //> Source statement or expression.
  role: MVPFactoryControlUserRole;
//> Brace or statement terminator.
};

//> Function declaration.
function normalizeRole(input: string | null | undefined): MVPFactoryControlUserRole | null {
  //> Variable declaration.
  const value = String(input || "")
    //> Source statement or expression.
    .trim()
    //> Source statement or expression.
    .toUpperCase();
  //> Conditional branch.
  if (!value) return null;
  //> Conditional branch.
  if (MVP_FACTORY_CONTROL_USER_ROLES.includes(value as MVPFactoryControlUserRole)) {
    //> Return a value.
    return value as MVPFactoryControlUserRole;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return null;
//> Brace or statement terminator.
}

//> Function declaration.
function parseEmailList(raw: string | undefined): Set<string> {
  //> Variable declaration.
  const emails = String(raw || "")
    //> Source statement or expression.
    .split(/[,\n; ]+/g)
    //> Source statement or expression.
    .map((entry) => entry.trim().toLowerCase())
    //> Source statement or expression.
    .filter(Boolean);
  //> Return a value.
  return new Set(emails);
//> Brace or statement terminator.
}

//> Function declaration.
function resolveRoleFromEmail(email: string | null): MVPFactoryControlUserRole | null {
  //> Conditional branch.
  if (!email) return null;
  //> Variable declaration.
  const normalized = email.trim().toLowerCase();
  //> Conditional branch.
  if (!normalized) return null;

  //> Variable declaration.
  const adminEmails = parseEmailList(process.env.MVP_FACTORY_CONTROL_RBAC_ADMIN_EMAILS);
  //> Conditional branch.
  if (adminEmails.has(normalized)) return "ADMIN";

  //> Variable declaration.
  const operatorEmails = parseEmailList(process.env.MVP_FACTORY_CONTROL_RBAC_OPERATOR_EMAILS);
  //> Conditional branch.
  if (operatorEmails.has(normalized)) return "OPERATOR";

  //> Variable declaration.
  const viewerEmails = parseEmailList(process.env.MVP_FACTORY_CONTROL_RBAC_VIEWER_EMAILS);
  //> Conditional branch.
  if (viewerEmails.has(normalized)) return "VIEWER";

  //> Variable declaration.
  const clientEmails = parseEmailList(process.env.MVP_FACTORY_CONTROL_RBAC_CLIENT_EMAILS);
  //> Conditional branch.
  if (clientEmails.has(normalized)) return "CLIENT";

  //> Return a value.
  return null;
//> Brace or statement terminator.
}

//> Function declaration.
function resolveDefaultRole(): MVPFactoryControlUserRole {
  //> Return a value.
  return normalizeRole(process.env.MVP_FACTORY_CONTROL_RBAC_DEFAULT_ROLE) || "OPERATOR";
//> Brace or statement terminator.
}

//> Export declaration.
export function resolveMVPFactoryControlUserRole(email: string | null): MVPFactoryControlUserRole {
  //> Return a value.
  return resolveRoleFromEmail(email) || resolveDefaultRole();
//> Brace or statement terminator.
}

//> Function declaration.
function formatAllowedRoles(roles: MVPFactoryControlUserRole[]) {
  //> Return a value.
  return roles.join(", ");
//> Brace or statement terminator.
}

//> Async function declaration.
async function recordRbacAuditEvent(input: {
  //> Source statement or expression.
  action: string;
  //> Source statement or expression.
  role: MVPFactoryControlUserRole;
  //> Source statement or expression.
  allowed: boolean;
  //> Source statement or expression.
  reason: string;
  //> Source statement or expression.
  userId: string | null;
  //> Source statement or expression.
  userEmail: string | null;
  //> Source statement or expression.
  allowedRoles: MVPFactoryControlUserRole[];
  //> Source statement or expression.
  entityType?: string;
  //> Source statement or expression.
  entityId?: string | null;
  //> Source statement or expression.
  metadata?: Prisma.JsonObject;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const metadata: Prisma.JsonObject = {
    //> Source statement or expression.
    userId: input.userId,
    //> Source statement or expression.
    userEmail: input.userEmail,
    //> Source statement or expression.
    role: input.role,
    //> Source statement or expression.
    allowedRoles: input.allowedRoles,
    //> Source statement or expression.
    ...(input.metadata || {})
  //> Brace or statement terminator.
  };

  //> Await async value.
  await prisma.lifecycleAuditEvent.create({
    //> Source statement or expression.
    data: {
      //> Source statement or expression.
      entityType: input.entityType || "RBAC",
      //> Source statement or expression.
      entityId: input.entityId || null,
      //> Source statement or expression.
      actorRole: `RBAC_${input.role}`,
      //> Source statement or expression.
      action: input.action,
      //> Source statement or expression.
      fromState: null,
      //> Source statement or expression.
      toState: null,
      //> Source statement or expression.
      allowed: input.allowed,
      //> Source statement or expression.
      reason: input.reason,
      //> Source statement or expression.
      metadata
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  });
//> Brace or statement terminator.
}

//> Export declaration.
export async function requireRbacAccess(
  //> Source statement or expression.
  options: RequireRbacAccessOptions
//> Source statement or expression.
): Promise<RbacAuthContext> {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //> Const with function or expression.
  const userId = ((session.user as any).id as string | undefined) || null;
  //> Variable declaration.
  const userEmail = session.user.email ? String(session.user.email).trim().toLowerCase() : null;
  //> Variable declaration.
  const role = resolveMVPFactoryControlUserRole(userEmail);
  //> Variable declaration.
  const allowed = options.allowedRoles.includes(role);

  //> Variable declaration.
  const reason = allowed
    //> Source statement or expression.
    ? `RBAC allow: role ${role} authorized for ${options.action}.`
    //> Source statement or expression.
    : `Access denied: role ${role} cannot perform ${options.action}. Required roles: ${formatAllowedRoles(
        //> Source statement or expression.
        options.allowedRoles
      //> Source statement or expression.
      )}.`;

  //> Await async value.
  await recordRbacAuditEvent({
    //> Source statement or expression.
    action: options.action,
    //> Source statement or expression.
    role,
    //> Source statement or expression.
    allowed,
    //> Source statement or expression.
    reason,
    //> Source statement or expression.
    userId,
    //> Source statement or expression.
    userEmail,
    //> Source statement or expression.
    allowedRoles: options.allowedRoles,
    //> Source statement or expression.
    entityType: options.entityType,
    //> Source statement or expression.
    entityId: options.entityId || userId,
    //> Source statement or expression.
    metadata: options.metadata
  //> Brace or statement terminator.
  });

  //> Conditional branch.
  if (!allowed) {
    //> Throw error.
    throw new Error(reason);
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { userId, userEmail, role };
//> Brace or statement terminator.
}
