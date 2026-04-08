import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(process.env.ALLOWED_ORIGINS && {
    allowedDevOrigins: process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
  }),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.unsplash.com" },
    ],
  },
};

export default nextConfig;
