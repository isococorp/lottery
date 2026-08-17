import { NextRequest, NextResponse } from "next/server";

// Lightweight in-memory rate limiter for API routes (Phase 6 hardening).
// For multi-instance production, back this with Redis; per-instance is a
// reasonable default behind a single nginx reverse proxy (srv pattern).
const WINDOW_MS = 60_000;
const MAX_REQ = 60;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.count++;
  return e.count > MAX_REQ;
}

export function middleware(req: NextRequest) {
  const res =
    req.nextUrl.pathname.startsWith("/api/")
      ? (() => {
          const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
          if (rateLimited(ip)) {
            return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
          }
          return NextResponse.next();
        })()
      : NextResponse.next();

  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = { matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"] };
