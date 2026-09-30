import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "www.screenscraper.fr" }, { protocol: "https", hostname: "*.screenscraper.fr" }],
  },
};

export default nextConfig;
