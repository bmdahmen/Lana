import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The bottom-left dev indicator collides with the mobile bottom tab bar.
  devIndicators: {
    position: "top-right",
  },
  experimental: {
    staleTimes: { dynamic: 1800, static: 1800 },
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
