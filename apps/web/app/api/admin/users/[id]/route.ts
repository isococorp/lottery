import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateTempPassword } from "@/lib/password";
import { requireRole, unauthorized, forbidden } from "@/lib/auth-guard";
import { revokeAllUserSessions } from "@/lib/session";
import { writeAuditLog, getClientInfo } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!actor) return unauthorized();

  const { id } = await params;
  const { ipAddress, userAgent } = getClientInfo(req);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  }

  let body: {
    displayName?: string;
    role?: string;
    status?: string;
    action?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Force logout action
  if (body.action === "force-logout") {
    await revokeAllUserSessions(target.id);
    await writeAuditLog({
      userId: actor.id,
      actorEmail: actor.email,
      action: "FORCE_LOGOUT",
      targetType: "User",
      targetId: target.id,
      ipAddress,
      userAgent,
      method: "PATCH",
      path: `/api/admin/users/${id}`,
      statusCode: 200,
    });
    return NextResponse.json({ ok: true });
  }

  // Reset password action
  if (body.action === "reset-password") {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    await revokeAllUserSessions(target.id);
    await writeAuditLog({
      userId: actor.id,
      actorEmail: actor.email,
      action: "PASSWORD_RESET_BY_ADMIN",
      targetType: "User",
      targetId: target.id,
      ipAddress,
      userAgent,
      method: "PATCH",
      path: `/api/admin/users/${id}`,
      statusCode: 200,
    });
    return NextResponse.json({ ok: true, tempPassword });
  }

  // Update user fields
  const beforeState = {
    displayName: target.displayName,
    role: target.role,
    status: target.status,
  };

  const updateData: Record<string, unknown> = {};
  let auditAction: "USER_UPDATE" | "ROLE_CHANGE" | "USER_STATUS_CHANGE" = "USER_UPDATE";

  if (body.displayName && body.displayName !== target.displayName) {
    updateData.displayName = body.displayName;
  }

  if (body.role && body.role !== target.role) {
    if (actor.role !== "SUPER_ADMIN") return forbidden();
    updateData.role = body.role;
    auditAction = "ROLE_CHANGE";
  }

  if (body.status && body.status !== target.status) {
    updateData.status = body.status;
    auditAction = "USER_STATUS_CHANGE";
    if (body.status === "SUSPENDED" || body.status === "DISABLED") {
      await revokeAllUserSessions(target.id);
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true, message: "ไม่มีการเปลี่ยนแปลง" });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  const afterState = {
    displayName: updated.displayName,
    role: updated.role,
    status: updated.status,
  };

  await writeAuditLog({
    userId: actor.id,
    actorEmail: actor.email,
    action: auditAction,
    targetType: "User",
    targetId: target.id,
    ipAddress,
    userAgent,
    method: "PATCH",
    path: `/api/admin/users/${id}`,
    statusCode: 200,
    beforeState,
    afterState,
  });

  return NextResponse.json({ ok: true, user: afterState });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await requireRole("SUPER_ADMIN");
  if (!actor) return forbidden();

  const { id } = await params;
  const { ipAddress, userAgent } = getClientInfo(req);

  if (id === actor.id) {
    return NextResponse.json(
      { error: "ไม่สามารถลบบัญชีตัวเองได้" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  }

  await revokeAllUserSessions(target.id);

  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });

  await writeAuditLog({
    userId: actor.id,
    actorEmail: actor.email,
    action: "USER_DELETE",
    targetType: "User",
    targetId: id,
    ipAddress,
    userAgent,
    method: "DELETE",
    path: `/api/admin/users/${id}`,
    statusCode: 200,
    beforeState: {
      email: target.email,
      username: target.username,
      role: target.role,
      displayName: target.displayName,
    },
  });

  return NextResponse.json({ ok: true });
}
