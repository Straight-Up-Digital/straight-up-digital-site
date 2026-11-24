import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL("http://localhost:4321");
  const sitemap = new URL("sitemap-index.xml", base).toString();

  const body = `User-agent: *
Allow: /
Disallow: /thank-you

Sitemap: ${sitemap}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
