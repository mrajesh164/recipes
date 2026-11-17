import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the workspace package's TypeScript directly, rather than making
  // packages/core emit a dist/ before the app can import it.
  transpilePackages: ["@recipes/core"],
  images: {
    // Every host the 325-recipe corpus actually draws from, enumerated
    // rather than wildcarded: a wildcard would let any URL that reached
    // the database become an outbound request from our server.
    remotePatterns: [
      { protocol: "https", hostname: "assets.bonappetit.com" },
      { protocol: "https", hostname: "assets.epicurious.com" },
      { protocol: "https", hostname: "bakeorbreak.com" },
      { protocol: "https", hostname: "barefeetinthekitchen.com" },
      { protocol: "https", hostname: "bromabakery.com" },
      { protocol: "https", hostname: "cdn.apartmenttherapy.info" },
      { protocol: "https", hostname: "cdn.bakedbyrachel.com" },
      { protocol: "https", hostname: "cdn.loveandlemons.com" },
      { protocol: "https", hostname: "images.immediate.co.uk" },
      { protocol: "https", hostname: "joythebaker.com" },
      { protocol: "https", hostname: "mojo.generalmills.com" },
      { protocol: "https", hostname: "natashaskitchen.com" },
      { protocol: "https", hostname: "stordfkenticomedia.blob.core.windows.net" },
      { protocol: "https", hostname: "tutti-dolci.com" },
      { protocol: "https", hostname: "www.averiecooks.com" },
      { protocol: "https", hostname: "www.kingarthurbaking.com" },
      { protocol: "https", hostname: "www.livewellbakeoften.com" },
      { protocol: "https", hostname: "www.loveandlemons.com" },
      { protocol: "https", hostname: "www.mybakingaddiction.com" },
      { protocol: "https", hostname: "www.onceuponachef.com" },
      { protocol: "https", hostname: "www.recipetineats.com" },
      { protocol: "https", hostname: "www.saltysidedish.com" },
      { protocol: "https", hostname: "www.spendwithpennies.com" },
      { protocol: "https", hostname: "www.tasteofhome.com" },
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
