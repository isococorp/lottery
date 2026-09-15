import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQ = 60;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_REQ = 10;
const hits = new Map<string, { count: number; reset: number }>();
const loginHits = new Map<string, { count: number; reset: number }>();

function rateLimited(
  store: Map<string, { count: number; reset: number }>,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const e = store.get(key);
  if (!e || now > e.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  e.count++;
  return e.count > max;
}

const SESSION_COOKIE = "tianming_session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  // Login-specific rate limiting
  if (pathname === "/api/auth/login" && req.method === "POST") {
    if (rateLimited(loginHits, ip, LOGIN_MAX_REQ, LOGIN_WINDOW_MS)) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "คำขอมากเกินไป กรุณาลองใหม่ภายหลัง" },
          { status: 429 },
        ),
      );
    }
  }

  // General API rate limiting
  if (pathname.startsWith("/api/")) {
    if (rateLimited(hits, ip, MAX_REQ, WINDOW_MS)) {
      return withSecurityHeaders(
        NextResponse.json({ error: "rate limit exceeded" }, { status: 429 }),
      );
    }
  }

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico";

  const hasSession = req.cookies.has(SESSION_COOKIE);

  // Redirect root to login always (no info leak)
  if (pathname === "/") {
    if (hasSession) {
      const dashUrl = req.nextUrl.clone();
      dashUrl.pathname = "/dashboard";
      return withSecurityHeaders(NextResponse.redirect(dashUrl));
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // Protect everything except public paths
  if (!isPublic && !hasSession) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 }),
      );
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // Redirect logged-in users away from /login
  if (pathname === "/login" && hasSession) {
    const dashUrl = req.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return withSecurityHeaders(NextResponse.redirect(dashUrl));
  }

  return withSecurityHeaders(NextResponse.next());
}

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
