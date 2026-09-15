import { NextRequest, NextResponse } from "next/server";
import { engineGet } from "@/lib/engine";

export async function GET(req: NextRequest) {
  try {
    const qs = new URL(req.url).searchParams.toString();
    const data = await engineGet(`/hit-summary${qs ? `?${qs}` : ""}`);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
