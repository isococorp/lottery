import { NextResponse } from "next/server";
import { engineGet } from "@/lib/engine";

export async function GET() {
  try {
    const data = await engineGet("/dates");
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
