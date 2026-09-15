import { NextResponse } from "next/server";
import { getSessionUser } from "./session";

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) return null;
  return user;
}

export async function requireRole(...roles: string[]) {
  const user = await getSessionUser();
  if (!user) return null;
  if (!roles.includes(user.role)) return null;
  return user;
}

export function forbidden() {
  return NextResponse.json(
    { error: "ไม่มีสิทธิ์เข้าถึง" },
    { status: 403 },
  );
}

export function unauthorized() {
  return NextResponse.json(
    { error: "ไม่ได้เข้าสู่ระบบ" },
    { status: 401 },
  );
}
