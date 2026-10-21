import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { staticPagePaths, checkStaticCoverage, checkSitemapXml } from "./check-sitemap.mjs";
import { buildSitemap } from "../src/utils/search-routes.mjs";

test("new or renamed static pages fail coverage checks while redirects and operational routes are excluded", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vinner-sitemap-"));
  try {
    for (const [file, source] of Object.entries({
      "index.astro": "<main>Home</main>",
      "new-page/index.astro": "<main>New page</main>",
      "old-page.astro": '---\nreturn Astro.redirect("/new-page/", 301);\n---',
      "api/report.astro": "<main>Operational endpoint</main>",
      "en/[...path].astro": "<main>English rewrite</main>",
      "products/[slug].astro": "<main>Dynamic product</main>"
    })) {
      const filename = path.join(root, file);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, source);
    }
    const pages = staticPagePaths(root);
    assert.deepEqual(pages, ["/", "/new-page/"]);
    assert.throws(() => checkStaticCoverage(pages, ["/", "/en/"]), /\/new-page\//);
    checkStaticCoverage(pages, ["/", "/en/", "/new-page/", "/en/new-page/"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("stale sitemap builds, legacy slugs and incorrect production hosts are rejected", () => {
  const origin = "https://vinnercare.com";
  const xml = buildSitemap(origin);
  assert.ok(checkSitemapXml(xml, origin).urls > 0);
  for (const stale of [
    xml.replace(/  <url>[\s\S]*?<\/url>\n/, ""),
    xml.replaceAll("/products/series/cleansing-care/", "/products/series/carekeep/"),
    xml.replaceAll(origin, "https://preview.example.com")
  ]) assert.throws(() => checkSitemapXml(stale, origin), /stale/);
});
