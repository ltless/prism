import type { NextConfig } from "next";

const NEXT_ALLOWED = process.env.NEXT_ALLOWED_ORIGINS;
const allowedDevOrigins = NEXT_ALLOWED
  ? NEXT_ALLOWED.split(",").map((s) => s.trim())
  : [];

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "75mb",
    },
    proxyClientMaxBodySize: "75mb",
  },
  transpilePackages: [],
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:8080/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
