// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/**
 * The canonical site URL is never invented in code. Locally it falls back to
 * the dev server; on Netlify, the read-only URL env var is the site's main
 * address, so connecting a custom domain later updates canonicals and the
 * sitemap automatically. PUBLIC_SITE_URL can override it for a fixed domain.
 */
const site =
  process.env.PUBLIC_SITE_URL ||
  process.env.URL ||
  "http://localhost:4321";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "never",
  compressHTML: true,
  build: {
    format: "directory",
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/thank-you") &&
        !page.includes("/404") &&
        !page.includes("/privacy") &&
        !page.includes("/terms"),
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
