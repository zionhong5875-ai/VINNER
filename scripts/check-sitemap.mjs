import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSitemap, localizedSearchPaths, searchRoutes } from "../src/utils/search-routes.mjs";
import { searchConfig, getSearchConfig } from "../src/utils/search-config.mjs";

// Independent of the sitemap's hand-maintained static route list: new/renamed
// page files must not silently disappear from the sitemap during a build.
export function staticPagePaths(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith("_") || entry.name.includes("[") ||
        ["en", "api", "admin", "oauth"].includes(entry.name)) return [];
    const relative = `${prefix}${entry.name}`;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return staticPagePaths(filename, `${relative}/`);
    if (!/\.(astro|md|mdx)$/.test(entry.name)) return [];
    const source = fs.readFileSync(filename, "utf8").trim();
    // A pure redirect is deliberately absent from the sitemap.
    if (/^---[\s\S]*\breturn Astro\.redirect\([\s\S]*---$/.test(source)) return [];
    const route = relative.replace(/\.(astro|md|mdx)$/, "").replace(/(?:^|\/)index$/, "");
    return [`/${route.replace(/\/$/, "")}${route ? "/" : ""}`];
  }).sort();
}

export function checkStaticCoverage(pages, paths = localizedSearchPaths) {
  const missing = pages.flatMap(route => [route, `/en${route}`]).filter(route => !paths.includes(route));
  assert.equal(missing.length, 0, `Public pages missing from sitemap: ${missing.join(", ")}. Update search-routes.mjs.`);
}

export function checkSitemapXml(xml, origin = searchConfig.siteUrl) {
  // Exact comparison detects old build artifacts, changed slugs, missing
  // language versions, incorrect hosts and stale editorial dates together.
  assert.equal(xml === buildSitemap(origin), true,
    "Sitemap is stale or differs from current content/canonical routes. Rebuild the site.");
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(locations.length, localizedSearchPaths.length);
  assert.equal(new Set(locations).size, locations.length, "Duplicate sitemap URLs");
  assert.ok(locations.length <= 50000, "Split sitemap before exceeding 50,000 URLs");
  assert.ok(Buffer.byteLength(xml, "utf8") <= 50 * 1024 * 1024, "Sitemap exceeds 50 MB");
  for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.origin, origin);
    assert.equal(url.search + url.hash, "");
    assert.ok(url.pathname.endsWith("/"));
    assert.ok(!/^\/(?:en\/)?(?:api|admin|oauth)(?:\/|$)/.test(url.pathname));
  }
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const alternates = [...block[1].matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)];
    assert.deepEqual(alternates.map(match => match[1]), ["zh-CN", "en", "x-default"]);
    assert.equal(alternates[1][2], alternates[2][2]);
    for (const [, , href] of alternates) assert.ok(locations.includes(href), `Unlisted alternate: ${href}`);
  }
  return { origin, pages: searchRoutes.length, urls: locations.length, languageAlternates: locations.length * 3 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  // Match Astro's production .env loading as well as hosting-platform vars.
  const { loadEnv } = await import("vite");
  const config = getSearchConfig({ ...loadEnv("production", root, ""), ...process.env });
  checkStaticCoverage(staticPagePaths(path.join(root, "src/pages")));
  const built = process.argv.includes("--built");
  const xml = built ? fs.readFileSync(path.join(root, "dist/client/sitemap.xml"), "utf8") : buildSitemap(config.siteUrl);
  const result = checkSitemapXml(xml, config.siteUrl);
  console.log(`Sitemap ${built ? "build output" : "source"} check passed: ${result.pages} pages, ${result.urls} URLs, ${result.languageAlternates} language alternates; ${result.origin}.`);
}
