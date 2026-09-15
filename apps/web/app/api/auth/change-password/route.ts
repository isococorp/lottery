import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@/lib/password";
import { getSessionUser } from "@/lib/session";
import { writeAuditLog, getClientInfo } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(req);
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" },
      { status: 400 },
    );
  }

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    return NextResponse.json(
      { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  await writeAuditLog({
    userId: user.id,
    actorEmail: user.email,
    action: "PASSWORD_CHANGED",
    ipAddress,
    userAgent,
    method: "POST",
    path: "/api/auth/change-password",
    statusCode: 200,
  });

  const redirectTo = user.role === "MEMBER" ? "/dashboard" : "/admin";

  return NextResponse.json({ ok: true, redirectTo });
}
