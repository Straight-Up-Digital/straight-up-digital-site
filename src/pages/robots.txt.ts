import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("Set the public site origin in astro.config.mjs before rendering robots.txt.");
  const base = site;
  const sitemap = new URL("sitemap-index.xml", base).toString();

  const body = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${sitemap}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
