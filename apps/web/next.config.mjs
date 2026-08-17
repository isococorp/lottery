/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // NOTE: do NOT inline ENGINE_URL via `env` — that bakes it at build time and
  // breaks the container network. Server route handlers read process.env at runtime.
};
export default nextConfig;
