import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the workspace package's TypeScript directly, rather than making
  // packages/core emit a dist/ before the app can import it.
  transpilePackages: ["@recipes/core"],
  images: {
    // Only the hosts the corpus actually draws from. A wildcard here would let
    // any URL that reached the database become a request from our server.
    remotePatterns: [
      { protocol: "https", hostname: "www.kingarthurbaking.com" },
      { protocol: "https", hostname: "cdn.loveandlemons.com" },
      { protocol: "https", hostname: "www.loveandlemons.com" },
    ],
  },

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
