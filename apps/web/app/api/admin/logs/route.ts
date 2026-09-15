import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, unauthorized } from "@/lib/auth-guard";
import { writeAuditLog, getClientInfo } from "@/lib/audit";
export async function GET(req: NextRequest) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!actor) return unauthorized();

  const { ipAddress, userAgent } = getClientInfo(req);
  const sp = req.nextUrl.searchParams;

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "50", 10)));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  const action = sp.get("action");
  if (action) where.action = action;

  const severity = sp.get("severity");
  if (severity) where.severity = severity;

  const userId = sp.get("userId");
  if (userId) where.userId = userId;

  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    const timestamp: { gte?: Date; lte?: Date } = {};
    if (from) timestamp.gte = new Date(from);
    if (to) timestamp.lte = new Date(to);
    where.timestamp = timestamp;
  }

  const targetType = sp.get("targetType");
  if (targetType) where.targetType = targetType;

  // ADMIN cannot see logs of SUPER_ADMIN actions on other ADMINs
  if (actor.role === "ADMIN") {
    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: { id: true },
    });
    const superAdminIds = superAdmins.map((u) => u.id);
    if (superAdminIds.length > 0) {
      where.NOT = {
        AND: [
          { userId: { in: superAdminIds } },
          { targetType: "User" },
          {
            action: {
              in: ["ROLE_CHANGE", "USER_STATUS_CHANGE", "USER_DELETE", "FORCE_LOGOUT"],
            },
          },
        ],
      };
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const serialized = logs.map((log) => ({
    ...log,
    id: String(log.id),
    beforeState: log.beforeState ? JSON.parse(log.beforeState) : null,
    afterState: log.afterState ? JSON.parse(log.afterState) : null,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }));

  await writeAuditLog({
    userId: actor.id,
    actorEmail: actor.email,
    action: "VIEW_AUDIT_LOG",
    ipAddress,
    userAgent,
    method: "GET",
    path: "/api/admin/logs",
    statusCode: 200,
    severity: "DEBUG",
    metadata: { page, pageSize, filters: { action, severity, userId, from, to } },
  });

  return NextResponse.json({
    logs: serialized,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
