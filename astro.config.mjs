// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/**
 * The owner-selected public origin is used for canonicals and the sitemap
 * before DNS cutover, so search metadata is already aligned with the intended
 * custom domain.
 */
const site = "https://straightupdigital.co.za";

export default defineConfig({
  site,
  output: "static",
  // Netlify's static directory hosting resolves nested routes with a trailing
  // slash; keep page canonicals and sitemap URLs aligned with those 200 URLs.
  trailingSlash: "always",
  compressHTML: true,
  build: {
    format: "directory",
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/thank-you") &&
        !page.includes("/404"),
      changefreq: "monthly",
      priority: 0.7,
    }),
  ],
  devToolbar: {
    enabled: false,
  },
  vite: {
    build: {
      // Keep every script in its own file so the Content-Security-Policy can
      // use script-src 'self' without 'unsafe-inline' or hash maintenance.
      assetsInlineLimit: 0,
    },
  },
});
