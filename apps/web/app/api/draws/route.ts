// Member-facing draw entry (หน้า "กรอกผลหวย"). Any signed-in user may add or
// correct a draw; the write itself is identical to the admin path and every
// save is attributed to the member in the audit log.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized } from "@/lib/auth-guard";
import { getClientInfo } from "@/lib/audit";
import { listDraws, normalizeDraw, saveDraw, drawExists } from "@/lib/draws";
import type { DrawFields } from "@/lib/glo";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return unauthorized();

  // ?date=YYYY-MM-DD → existence check, used to warn before overwriting.
  const date = req.nextUrl.searchParams.get("date");
  if (date) return NextResponse.json({ date, exists: await drawExists(date) });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20, 100);
  return NextResponse.json(await listDraws(limit));
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return unauthorized();

  const { ipAddress, userAgent } = getClientInfo(req);

  let body: Partial<DrawFields>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await saveDraw({
    actor: user,
    draw: normalizeDraw(body),
    ipAddress,
    userAgent,
    path: "/api/draws",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, errors: result.errors, engine: result.engine },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}
