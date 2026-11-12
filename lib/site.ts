/**
 * The public origin of the site, used for canonical URLs, the sitemap and
 * social cards.
 *
 * Set NEXT_PUBLIC_SITE_URL (e.g. https://nammametro.example) for production.
 * On Vercel the production domain is picked up automatically. A production
 * build with neither fails here rather than publishing localhost URLs to
 * search engines.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. Set it to the site's public origin (e.g. https://example.com) before building for production.",
    );
  }
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
