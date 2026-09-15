// Shared draw-write pipeline used by both the admin page and the member
// "กรอกผลหวย" page. Kept in one place so the two entry points can never drift
// on validation, write order, or audit trail.
//
// Write order is deliberate: the Excel audit source goes first (the engine owns
// that file and reloads its caches), the DB second. A failure in step 1 leaves
// nothing written; a failure in step 2 is reported as a partial write rather
// than as success.
import { prisma } from "./prisma";
import { writeAuditLog } from "./audit";
import { enginePost } from "./engine";
import { validateDraw, type DrawFields } from "./glo";

const FIELDS = ["six", "top3", "top2", "bottom2", "set1", "set2", "set3", "set4"] as const;

export interface Actor {
  id: string;
  email: string;
  role: string;
}

export type SaveOutcome =
  | { ok: true; action: string; draw: DrawFields; engine: Record<string, unknown> }
  | { ok: false; status: number; error: string; errors?: string[]; engine?: Record<string, unknown> };

export function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Coerce an untrusted request body into a fully-formed DrawFields. */
export function normalizeDraw(body: Partial<DrawFields>): DrawFields {
  const draw: DrawFields = {
    date: String(body.date ?? "").trim(),
    six: null, top3: null, top2: null, bottom2: null,
    set1: null, set2: null, set3: null, set4: null,
    drawTime: (body.drawTime ?? "16:00") || null,
  };
  for (const f of FIELDS) {
    const v = body[f];
    draw[f] = v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim();
  }
  return draw;
}

export async function listDraws(limit: number) {
  const draws = await prisma.draw.findMany({ orderBy: { date: "desc" }, take: limit });
  const total = await prisma.draw.count();
  return {
    total,
    draws: draws.map((d) => ({
      ...d,
      date: d.date.toISOString().slice(0, 10),
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

/** Does a draw already exist for this ISO date? Used to warn before overwriting. */
export async function drawExists(iso: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const found = await prisma.draw.findUnique({ where: { date: toUtcDate(iso) } });
  return Boolean(found);
}

export async function saveDraw(opts: {
  actor: Actor;
  draw: DrawFields;
  ipAddress: string;
  userAgent: string;
  path: string;
}): Promise<SaveOutcome> {
  const { actor, draw, ipAddress, userAgent, path } = opts;

  const errors = validateDraw(draw);
  if (errors.length) {
    return { ok: false, status: 422, error: errors.join(" · "), errors };
  }

  const dateKey = toUtcDate(draw.date);
  const before = await prisma.draw.findUnique({ where: { date: dateKey } });

  // 1) Excel audit source (engine validates again, backs up, reloads caches).
  let engineResult: Record<string, unknown>;
  try {
    engineResult = await enginePost("/data/draw", draw);
  } catch (err) {
    await writeAuditLog({
      userId: actor.id, actorEmail: actor.email, action: "DRAW_UPSERT",
      targetType: "Draw", targetId: draw.date,
      ipAddress, userAgent, method: "POST", path,
      statusCode: 502, severity: "ERROR",
      metadata: { stage: "engine", role: actor.role, error: String(err) },
    });
    return {
      ok: false,
      status: 502,
      error: `เขียนลงไฟล์ Excel ผ่าน engine ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 2) DB. Excel is already ahead if this throws, so report a partial write.
  const record = {
    date: dateKey,
    six: draw.six, top3: draw.top3, top2: draw.top2, bottom2: draw.bottom2,
    set1: draw.set1, set2: draw.set2, set3: draw.set3, set4: draw.set4,
    drawTime: draw.drawTime,
  };
  try {
    await prisma.draw.upsert({ where: { date: dateKey }, update: record, create: record });
  } catch (err) {
    await writeAuditLog({
      userId: actor.id, actorEmail: actor.email, action: "DRAW_UPSERT",
      targetType: "Draw", targetId: draw.date,
      ipAddress, userAgent, method: "POST", path,
      statusCode: 500, severity: "CRITICAL",
      metadata: { stage: "db", role: actor.role, error: String(err), engine: engineResult },
    });
    return {
      ok: false,
      status: 500,
      error: `บันทึกลง Excel สำเร็จแล้ว แต่บันทึกลงฐานข้อมูลไม่สำเร็จ: ${String(err)}`,
      engine: engineResult,
    };
  }

  await writeAuditLog({
    userId: actor.id, actorEmail: actor.email, action: "DRAW_UPSERT",
    targetType: "Draw", targetId: draw.date,
    ipAddress, userAgent, method: "POST", path,
    statusCode: 200,
    beforeState: before
      ? { ...before, date: before.date.toISOString().slice(0, 10), createdAt: undefined }
      : null,
    afterState: draw,
    metadata: {
      action: engineResult.action,
      role: actor.role,
      backup: engineResult.backup,
      grade: engineResult.grade,
      totalRows: engineResult.total_rows,
    },
  });

  return {
    ok: true,
    action: String(engineResult.action ?? "saved"),
    draw,
    engine: engineResult,
  };
}
