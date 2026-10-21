import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "parse5";
import { localizedSearchPaths, searchRoutes } from "../src/utils/search-routes.mjs";
import { searchConfig, INDEXNOW_KEY } from "../src/utils/search-config.mjs";
import products from "../src/data/site/products.json" with { type: "json" };
import { getProductLinePublicSlug } from "../src/utils/productLines.js";
import { publishedTerms, glossaryPublicSlug } from "../src/utils/glossary.mjs";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4321";
const indexable = process.env.AUDIT_EXPECT_INDEXING === "true";
const origin = searchConfig.siteUrl;
const get = (path, options = {}) => fetch(new URL(path, base), { redirect: "manual", ...options });
const nodes = (root, predicate) => {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); node.childNodes?.forEach(visit); };
  visit(root);
  return found;
};
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const errors = [];
const legacyRedirects = [
  ["/about/factory/", "/about/vinner/"],
  ["/en/about/factory/", "/en/about/vinner/"],
  ...products.lines.flatMap(line => ["zh", "en"].flatMap(language => {
    const slug = getProductLinePublicSlug(line.slug, language);
    const prefix = language === "en" ? "/en" : "";
    return slug === line.slug ? [] : [[`${prefix}/products/series/${line.slug}/`, `${prefix}/products/series/${slug}/`]];
  })),
  ...publishedTerms.flatMap(term => {
    const slug = glossaryPublicSlug(term.slug, "en");
    return slug === term.slug ? [] : [[`/en/resources/glossary/${term.slug}/`, `/en/resources/glossary/${slug}/`]];
  })
];
async function check(name, run) {
  try { await run(); } catch (error) { errors.push(`${name}: ${error.message}`); }
}

for (const [source, destination] of legacyRedirects) {
  await check(`legacy ${source}`, async () => {
    assert.ok(!localizedSearchPaths.includes(source), "Redirect must not appear in sitemap");
    assert.ok(localizedSearchPaths.includes(destination), "Redirect destination must be canonical");
    const response = await get(`${source}?ref=url-migration`);
    assert.equal(response.status, 301);
    const location = new URL(response.headers.get("location"), base);
    assert.equal(location.pathname, destination);
  });
}

for (const path of localizedSearchPaths) {
  await check(path, async () => {
    const response = await get(`${path}?utm_source=audit&ref=duplicate`);
    assert.equal(response.status, 200);
    const html = parse(await response.text());
    const canonical = nodes(html, node => node.tagName === "link" && attr(node, "rel") === "canonical");
    assert.equal(canonical.length, 1);
    assert.equal(attr(canonical[0], "href"), `${origin}${path}`);
    const pair = searchRoutes.find(route => path === route.path || path === `/en${route.englishPath || route.path}`);
    assert.ok(pair, "Page has no language pair");
    const english = `${origin}/en${pair.englishPath || pair.path}`;
    const alternates = nodes(html, node => node.tagName === "link" && attr(node, "rel") === "alternate" && attr(node, "hreflang"));
    assert.equal(alternates.length, 3);
    assert.deepEqual(Object.fromEntries(alternates.map(node => [attr(node, "hreflang"), attr(node, "href")])), {
      "zh-CN": `${origin}${pair.path}`, en: english, "x-default": english
    });
    const robots = nodes(html, node => node.tagName === "meta" && attr(node, "name") === "robots");
    assert.equal(robots.length, 1);
    assert.equal(/noindex/.test(attr(robots[0], "content")), !indexable);
    assert.equal(/noindex/.test(response.headers.get("x-robots-tag") || ""), !indexable);
    if (path !== "/") {
      const redirect = await get(`${path.slice(0, -1)}?utm_source=audit`);
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.get("location"), `${path}?utm_source=audit`);
    }
  });
}

await check("robots.txt", async () => {
  const response = await get("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  const text = await response.text();
  if (indexable) {
    assert.match(text, /Disallow: \/admin/);
    assert.ok(text.includes(`Sitemap: ${origin}/sitemap.xml`));
    assert.doesNotMatch(text, /^Disallow: \/$/m);
  } else assert.match(text, /^Disallow: \/$/m);
});

await check("sitemap.xml", async () => {
  const response = await get("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locations.sort(), localizedSearchPaths.map(path => `${origin}${path}`).sort());
  assert.equal(new Set(locations).size, locations.length);
});

await check("IndexNow verification file", async () => {
  const response = await get(`/${INDEXNOW_KEY}.txt`);
  assert.equal(response.status, 200);
  assert.equal((await response.text()).trim(), INDEXNOW_KEY);
});

await check("request headers cannot override the canonical or language", async () => {
  const response = await get("/contact/", { headers: { "x-vinner-language": "en", "x-vinner-public-path": "/en/forged/" } });
  const html = parse(await response.text());
  const canonical = nodes(html, node => node.tagName === "link" && attr(node, "rel") === "canonical")[0];
  assert.equal(attr(canonical, "href"), `${origin}/contact/`);
  assert.equal(attr(nodes(html, node => node.tagName === "html")[0], "lang"), "zh-CN");
});

for (const path of ["/nonexistent-audit-page/", "/en/nonexistent-audit-page/"]) {
  await check(path, async () => {
    const response = await get(path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  });
}

console.log(`Crawl audit: ${localizedSearchPaths.length} parameterized pages, ${localizedSearchPaths.length - 1} slash redirects, ${legacyRedirects.length} legacy redirects, robots, sitemap, key, spoofed headers and 404s.`);
console.log(`Expected indexing: ${indexable}; failures: ${errors.length}`);
if (process.env.AUDIT_CRAWL_REPORT) {
  fs.writeFileSync(process.env.AUDIT_CRAWL_REPORT, JSON.stringify({
    base, origin, expectedIndexing: indexable, urls: localizedSearchPaths.length,
    slashRedirects: localizedSearchPaths.length - 1, legacyRedirects,
    checks: ["HTTP status", "self canonical", "reciprocal hreflang", "robots policy", "sitemap coverage", "legacy redirects", "404 noindex"],
    errors
  }, null, 2) + "\n");
}
errors.forEach(error => console.error(error));
if (errors.length) process.exitCode = 1;
