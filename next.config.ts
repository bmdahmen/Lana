import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The bottom-left dev indicator collides with the mobile bottom tab bar.
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
