import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the workspace package's TypeScript directly, rather than making
  // packages/core emit a dist/ before the app can import it.
  transpilePackages: ["@recipes/core"],

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
