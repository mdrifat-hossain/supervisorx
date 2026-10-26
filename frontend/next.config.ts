import type { NextConfig } from "next";

// Disable development indicator & overlay UI for clean preview
process.env.__NEXT_DISABLE_DEV_OVERLAY_UX = "true";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable development indicator UI (e.g. "N Issues" badge); can be re-enabled later
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
