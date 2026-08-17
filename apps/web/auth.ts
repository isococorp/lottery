// NextAuth v5 configuration (Phase 6). LINE + Facebook OAuth, matching the
// existing Tianming Ge pattern. Providers are only enabled when their secrets
// are present, so the app still builds/runs in environments without OAuth keys.
import NextAuth from "next-auth";
import Facebook from "next-auth/providers/facebook";
import type { Provider } from "next-auth/providers";

// LINE is an OIDC provider; configured generically to avoid a hard dependency
// on a specific provider export across next-auth versions.
function lineProvider(): Provider | null {
  if (!process.env.LINE_CLIENT_ID || !process.env.LINE_CLIENT_SECRET) return null;
  return {
    id: "line",
    name: "LINE",
    type: "oidc",
    issuer: "https://access.line.me",
    clientId: process.env.LINE_CLIENT_ID,
    clientSecret: process.env.LINE_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile email" } },
    checks: ["state"],
  } as Provider;
}

const providers: Provider[] = [];
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    })
  );
}
const line = lineProvider();
if (line) providers.push(line);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
});
