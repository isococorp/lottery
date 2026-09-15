// Preview the latest GLO draw. Read-only: nothing is written until the admin
// confirms via POST /api/admin/draws.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, unauthorized } from "@/lib/auth-guard";
import { writeAuditLog, getClientInfo } from "@/lib/audit";
import { fetchLatestDraw, validateDraw } from "@/lib/glo";

export async function GET(req: NextRequest) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!actor) return unauthorized();

  const { ipAddress, userAgent } = getClientInfo(req);

  let result;
  try {
    result = await fetchLatestDraw();
  } catch (err) {
    await writeAuditLog({
      userId: actor.id,
      actorEmail: actor.email,
      action: "DRAW_FETCH",
      ipAddress,
      userAgent,
      method: "GET",
      path: "/api/admin/draws/fetch",
      statusCode: 502,
      severity: "WARNING",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { error: `ดึงข้อมูลจาก GLO ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const existing = await prisma.draw.findUnique({
    where: { date: new Date(`${result.mapped.date}T00:00:00.000Z`) },
  });

  await writeAuditLog({
    userId: actor.id,
    actorEmail: actor.email,
    action: "DRAW_FETCH",
    targetType: "Draw",
    targetId: result.mapped.date,
    ipAddress,
    userAgent,
    method: "GET",
    path: "/api/admin/draws/fetch",
    statusCode: 200,
    metadata: { date: result.mapped.date, alreadyInDb: Boolean(existing) },
  });

  return NextResponse.json({
    raw: result.raw,
    draw: result.mapped,
    warnings: validateDraw(result.mapped),
    alreadyInDb: Boolean(existing),
  });
}
