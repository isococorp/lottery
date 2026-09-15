// Admin draw management: list recent draws, and commit a new/edited draw to
// BOTH stores. The write pipeline itself lives in lib/draws so this and the
// member-facing /api/draws can never drift apart.
import { NextRequest, NextResponse } from "next/server";
import { requireRole, unauthorized } from "@/lib/auth-guard";
import { getClientInfo } from "@/lib/audit";
import { listDraws, normalizeDraw, saveDraw } from "@/lib/draws";
import type { DrawFields } from "@/lib/glo";

export async function GET(req: NextRequest) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!actor) return unauthorized();

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20, 100);
  return NextResponse.json(await listDraws(limit));
}

export async function POST(req: NextRequest) {
  const actor = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!actor) return unauthorized();

  const { ipAddress, userAgent } = getClientInfo(req);

  let body: Partial<DrawFields>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await saveDraw({
    actor,
    draw: normalizeDraw(body),
    ipAddress,
    userAgent,
    path: "/api/admin/draws",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, errors: result.errors, engine: result.engine },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}
