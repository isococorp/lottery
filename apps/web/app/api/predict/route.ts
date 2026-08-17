import { NextRequest, NextResponse } from "next/server";
import { enginePost } from "@/lib/engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await enginePost("/predict", {
      date: body.date,
      time: body.time ?? "16:00",
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
