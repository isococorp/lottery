import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, revokeCurrentSession } from "@/lib/session";
import { writeAuditLog, getClientInfo } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(req);
  const user = await getSessionUser();

  await revokeCurrentSession();

  if (user) {
    await writeAuditLog({
      userId: user.id,
      actorEmail: user.email,
      action: "LOGOUT",
      ipAddress,
      userAgent,
      method: "POST",
      path: "/api/auth/logout",
      statusCode: 200,
    });
  }

  return NextResponse.json({ ok: true });
}
