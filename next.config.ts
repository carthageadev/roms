import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React StrictMode double-mounts the hero, which builds a second WebGL renderer
  // and loses the first GL context, so the line never animates in `next dev`.
  // Strictness is still enforced by tsc and eslint.
  reactStrictMode: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "www.screenscraper.fr" }, { protocol: "https", hostname: "*.screenscraper.fr" }],
  },
};

export default nextConfig;