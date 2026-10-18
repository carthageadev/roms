import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The home page mounts a WebGL canvas. React's dev StrictMode double-mounts
  // effects, which creates a second renderer and loses the first GL context, so
  // the ring never animates in `next dev`. Strictness is still enforced by
  // tsc and eslint.
  reactStrictMode: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "www.screenscraper.fr" }, { protocol: "https", hostname: "*.screenscraper.fr" }],
  },
};

export default nextConfig;
