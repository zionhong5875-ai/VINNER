export const DEFAULT_SITE_URL = "https://vinnercare.com";
export const INDEXNOW_KEY = "b9001a0e275974da9479bb3283076c6b";

export function getSearchConfig(env = {}) {
  const url = new URL(env.PUBLIC_SITE_URL || DEFAULT_SITE_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("PUBLIC_SITE_URL must be an HTTPS origin without a path, query, or credentials.");
  }
  if (url.port || !url.hostname.includes(".") || /^\d+(?:\.\d+){3}$/.test(url.hostname) ||
    url.hostname.startsWith("[") || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) {
    throw new Error("PUBLIC_SITE_URL must use a public production hostname.");
  }
  const mode = env.SITE_INDEXING_ENABLED || "auto";
  if (!["auto", "true", "false"].includes(mode)) {
    throw new Error("SITE_INDEXING_ENABLED must be auto, true, or false.");
  }
  if (mode === "true" && !env.PUBLIC_SITE_URL) {
    throw new Error("Set PUBLIC_SITE_URL explicitly before enabling production indexing.");
  }
  return {
    siteUrl: url.origin,
    // EdgeOne preview/local requests remain blocked by canIndexRequest's host
    // check, even when they share the production build's environment variables.
    indexingEnabled: mode === "true" || (mode === "auto" && Boolean(env.PUBLIC_SITE_URL))
  };
}

export const searchConfig = getSearchConfig({ ...process.env, ...import.meta.env });

export function canIndexRequest(url, config = searchConfig) {
  return config.indexingEnabled && url.host === new URL(config.siteUrl).host;
}

export function robotsText(config, indexable) {
  return indexable
    ? ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", "Disallow: /oauth",
      "Disallow: /en/admin", "Disallow: /en/api/", "Disallow: /en/oauth", "",
      `Sitemap: ${config.siteUrl}/sitemap.xml`, ""].join("\n")
    : "User-agent: *\nDisallow: /\n";
}
