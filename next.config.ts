import type { NextConfig } from "next";

const NEXT_ALLOWED = process.env.NEXT_ALLOWED_ORIGINS;
const allowedDevOrigins = NEXT_ALLOWED
  ? NEXT_ALLOWED.split(",").map((s) => s.trim())
  : [];

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  experimental: {
    // Canonical media limit is 200MB (enforced app-side in Go's upload
    // handler). 210 gives ~5% multipart-encoding headroom and must stay in
    // sync with the Echo BodyLimit on POST /api/v1/media (also 210MB).
    serverActions: {
      bodySizeLimit: "210mb",
    },
    proxyClientMaxBodySize: "210mb",
  },
  transpilePackages: [],
  allowedDevOrigins,
  async rewrites() {
    // Same-host localhost by default; override for split deployments
    // (e.g. docker compose: http://backend:8080). NOTE: rewrites() is
    // evaluated at `next build`, so this value is baked into the routes
    // manifest — pass it as a build-time env/ARG, not as runtime env to
    // `next start`.
    const backend = process.env.BACKEND_URL || "http://localhost:8080";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
