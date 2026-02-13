import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type WarRoomUserRole = "ADMIN" | "OPERATOR" | "VIEWER" | "CLIENT";

export const WARROOM_USER_ROLES: WarRoomUserRole[] = [
  "ADMIN",
  "OPERATOR",
  "VIEWER",
  "CLIENT"
];

type RequireRbacAccessOptions = {
  action: string;
  allowedRoles: WarRoomUserRole[];
  entityType?: string;
  entityId?: string | null;
  metadata?: Prisma.JsonObject;
};

type RbacAuthContext = {
  userId: string | null;
  userEmail: string | null;
  role: WarRoomUserRole;
};

function normalizeRole(input: string | null | undefined): WarRoomUserRole | null {
  const value = String(input || "")
    .trim()
    .toUpperCase();
  if (!value) return null;
  if (WARROOM_USER_ROLES.includes(value as WarRoomUserRole)) {
    return value as WarRoomUserRole;
  }
  return null;
}

function parseEmailList(raw: string | undefined): Set<string> {
  const emails = String(raw || "")
    .split(/[,\n; ]+/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

function resolveRoleFromEmail(email: string | null): WarRoomUserRole | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const adminEmails = parseEmailList(process.env.WARROOM_RBAC_ADMIN_EMAILS);
  if (adminEmails.has(normalized)) return "ADMIN";

  const operatorEmails = parseEmailList(process.env.WARROOM_RBAC_OPERATOR_EMAILS);
  if (operatorEmails.has(normalized)) return "OPERATOR";

  const viewerEmails = parseEmailList(process.env.WARROOM_RBAC_VIEWER_EMAILS);
  if (viewerEmails.has(normalized)) return "VIEWER";

  const clientEmails = parseEmailList(process.env.WARROOM_RBAC_CLIENT_EMAILS);
  if (clientEmails.has(normalized)) return "CLIENT";

  return null;
}

function resolveDefaultRole(): WarRoomUserRole {
  return normalizeRole(process.env.WARROOM_RBAC_DEFAULT_ROLE) || "OPERATOR";
}

export function resolveWarRoomUserRole(email: string | null): WarRoomUserRole {
  return resolveRoleFromEmail(email) || resolveDefaultRole();
}

function formatAllowedRoles(roles: WarRoomUserRole[]) {
  return roles.join(", ");
}

async function recordRbacAuditEvent(input: {
  action: string;
  role: WarRoomUserRole;
  allowed: boolean;
  reason: string;
  userId: string | null;
  userEmail: string | null;
  allowedRoles: WarRoomUserRole[];
  entityType?: string;
  entityId?: string | null;
  metadata?: Prisma.JsonObject;
}) {
  const metadata: Prisma.JsonObject = {
    userId: input.userId,
    userEmail: input.userEmail,
    role: input.role,
    allowedRoles: input.allowedRoles,
    ...(input.metadata || {})
  };

  await prisma.lifecycleAuditEvent.create({
    data: {
      entityType: input.entityType || "RBAC",
      entityId: input.entityId || null,
      actorRole: `RBAC_${input.role}`,
      action: input.action,
      fromState: null,
      toState: null,
      allowed: input.allowed,
      reason: input.reason,
      metadata
    }
  });
}

export async function requireRbacAccess(
  options: RequireRbacAccessOptions
): Promise<RbacAuthContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = ((session.user as any).id as string | undefined) || null;
  const userEmail = session.user.email ? String(session.user.email).trim().toLowerCase() : null;
  const role = resolveWarRoomUserRole(userEmail);
  const allowed = options.allowedRoles.includes(role);

  const reason = allowed
    ? `RBAC allow: role ${role} authorized for ${options.action}.`
    : `Access denied: role ${role} cannot perform ${options.action}. Required roles: ${formatAllowedRoles(
        options.allowedRoles
      )}.`;

  await recordRbacAuditEvent({
    action: options.action,
    role,
    allowed,
    reason,
    userId,
    userEmail,
    allowedRoles: options.allowedRoles,
    entityType: options.entityType,
    entityId: options.entityId || userId,
    metadata: options.metadata
  });

  if (!allowed) {
    throw new Error(reason);
  }

  return { userId, userEmail, role };
}
