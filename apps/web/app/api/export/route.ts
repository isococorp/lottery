import { NextRequest } from "next/server";
import { ENGINE_URL } from "@/lib/engine";

// Stream the engine-generated Excel through the BFF (ASCII filename preserved).
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") === "exact" ? "exact" : "permutation";
  const upstream = await fetch(`${ENGINE_URL}/backtest/export?mode=${mode}`, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("export failed", { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition":
        upstream.headers.get("content-disposition") ??
        `attachment; filename="tianming_backtest_${mode}.xlsx"`,
    },
  });
}
