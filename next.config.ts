import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: process.env.NEXT_DEV_INDICATORS !== "true" ? false : undefined,
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
