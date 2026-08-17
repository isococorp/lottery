import { NextRequest, NextResponse } from "next/server";
import { enginePost } from "@/lib/engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode === "exact" ? "exact" : "permutation";
    const data = await enginePost("/ml", { mode });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
