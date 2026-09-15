import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { writeAuditLog, getClientInfo } from "@/lib/audit";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(req);

  let body: { login?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { login, password } = body;
  if (!login || !password) {
    return NextResponse.json(
      { error: "กรุณากรอกอีเมล/ชื่อผู้ใช้ และรหัสผ่าน" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: login.toLowerCase() },
        { username: login.toLowerCase() },
      ],
    },
  });

  if (!user) {
    await writeAuditLog({
      action: "LOGIN_FAILED",
      ipAddress,
      userAgent,
      method: "POST",
      path: "/api/auth/login",
      statusCode: 401,
      metadata: { reason: "user_not_found", login },
    });
    return NextResponse.json(
      { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  if (user.status !== "ACTIVE") {
    await writeAuditLog({
      userId: user.id,
      actorEmail: user.email,
      action: "LOGIN_FAILED",
      ipAddress,
      userAgent,
      method: "POST",
      path: "/api/auth/login",
      statusCode: 403,
      severity: "WARNING",
      metadata: { reason: "account_not_active", status: user.status },
    });
    return NextResponse.json(
      { error: "บัญชีถูกระงับ ติดต่อผู้ดูแลระบบ" },
      { status: 403 },
    );
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000,
    );
    return NextResponse.json(
      { error: `บัญชีถูกล็อกชั่วคราว ลองใหม่ในอีก ${minutesLeft} นาที` },
      { status: 423 },
    );
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    const newCount = user.failedLoginCount + 1;
    const lockData: { failedLoginCount: number; lockedUntil?: Date } = {
      failedLoginCount: newCount,
    };

    if (newCount >= LOCKOUT_THRESHOLD) {
      lockData.lockedUntil = new Date(
        Date.now() + LOCKOUT_MINUTES * 60 * 1000,
      );
      await writeAuditLog({
        userId: user.id,
        actorEmail: user.email,
        action: "ACCOUNT_LOCKED",
        ipAddress,
        userAgent,
        method: "POST",
        path: "/api/auth/login",
        statusCode: 423,
        severity: "WARNING",
        metadata: { failedAttempts: newCount },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: lockData,
    });

    await writeAuditLog({
      userId: user.id,
      actorEmail: user.email,
      action: "LOGIN_FAILED",
      ipAddress,
      userAgent,
      method: "POST",
      path: "/api/auth/login",
      statusCode: 401,
      metadata: { reason: "wrong_password", attempt: newCount },
    });

    return NextResponse.json(
      { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  // Login success
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });

  await createSession(user.id, ipAddress, userAgent);

  await writeAuditLog({
    userId: user.id,
    actorEmail: user.email,
    action: "LOGIN_SUCCESS",
    ipAddress,
    userAgent,
    method: "POST",
    path: "/api/auth/login",
    statusCode: 200,
  });

  const redirectTo = user.mustChangePassword
    ? "/login/change-password"
    : user.role === "MEMBER"
      ? "/dashboard"
      : "/admin";

  return NextResponse.json({
    ok: true,
    redirectTo,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
