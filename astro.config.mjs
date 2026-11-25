// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/** Public origin used for canonicals and the sitemap. */
const site = "https://straightupdigital.co.za";

export default defineConfig({
  site,
  output: "static",
  // Cloudflare static assets serve nested routes with a trailing slash; keep
  // canonicals and sitemap URLs aligned with those URLs.
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
