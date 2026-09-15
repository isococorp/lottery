import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateTempPassword } from "@/lib/password";
import { requireRole, unauthorized, forbidden } from "@/lib/auth-guard";
import { writeAuditLog, getClientInfo } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) return unauthorized();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      createdBy: { select: { displayName: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!actor) return unauthorized();

  const { ipAddress, userAgent } = getClientInfo(req);

  let body: {
    email?: string;
    username?: string;
    displayName?: string;
    role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, username, displayName, role } = body;

  if (!email || !username || !displayName) {
    return NextResponse.json(
      { error: "กรุณากรอก email, username, และ displayName" },
      { status: 400 },
    );
  }

  const requestedRole = (role ?? "MEMBER") as "SUPER_ADMIN" | "ADMIN" | "MEMBER";
  if (
    (requestedRole === "ADMIN" || requestedRole === "SUPER_ADMIN") &&
    actor.role !== "SUPER_ADMIN"
  ) {
    return forbidden();
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "อีเมลหรือชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" },
      { status: 409 },
    );
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const newUser = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      displayName,
      passwordHash,
      role: requestedRole,
      createdById: actor.id,
      mustChangePassword: true,
    },
  });

  await writeAuditLog({
    userId: actor.id,
    actorEmail: actor.email,
    action: "USER_CREATE",
    targetType: "User",
    targetId: newUser.id,
    ipAddress,
    userAgent,
    method: "POST",
    path: "/api/admin/users",
    statusCode: 201,
    afterState: {
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
      displayName: newUser.displayName,
    },
  });

  return NextResponse.json(
    {
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role,
      },
      tempPassword,
    },
    { status: 201 },
  );
}
