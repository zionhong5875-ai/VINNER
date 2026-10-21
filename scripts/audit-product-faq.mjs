import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parse } from "parse5";
import products from "../src/data/site/products.json" with { type: "json" };
import backlinks from "../src/generated/glossary-backlinks.json" with { type: "json" };
import { glossaryPath } from "../src/utils/glossary.mjs";
import { linkGlossaryText } from "../src/utils/glossary-links.mjs";
import { searchConfig } from "../src/utils/search-config.mjs";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4321";
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const walk = node => [node, ...(node.childNodes || []).flatMap(walk)];
const content = node => walk(node).filter(n => n.nodeName === "#text").map(n => n.value).join("").replace(/\s+/g, " ").trim();
const normalize = text => text.replace(/\s+/g, " ").trim();
const pages = [];
const targets = new Map();

for (const sku of products.lines.flatMap(line => line.skus || []).filter(sku => !sku.comingSoon)) {
  for (const language of ["zh", "en"]) {
    const prefix = language === "en" ? "/en" : "";
    const route = `/products/${sku.slug}/`;
    const path = prefix + route;
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, path);
    const all = walk(parse(await response.text()));
    const meta = key => attr(all.find(n => n.tagName === "meta" && (attr(n, "name") === key || attr(n, "property") === key)) || {}, "content");
    const link = (rel, lang) => attr(all.find(n => n.tagName === "link" && attr(n, "rel") === rel && (!lang || attr(n, "hreflang") === lang)) || {}, "href");
    const publicUrl = new URL(path, searchConfig.siteUrl).href;
    assert.equal(link("canonical"), publicUrl, path);
    assert.equal(link("alternate", "zh-CN"), new URL(route, searchConfig.siteUrl).href);
    assert.equal(link("alternate", "en"), new URL(`/en${route}`, searchConfig.siteUrl).href);
    assert.equal(link("alternate", "x-default"), link("alternate", "en"));
    assert.ok(content(all.find(n => n.tagName === "title")));
    assert.ok(meta("description"));
    assert.equal(all.filter(n => n.tagName === "h1").length, 1);
    const graph = JSON.parse(all.find(n => n.tagName === "script" && attr(n, "type") === "application/ld+json").childNodes[0].value)["@graph"];
    assert.ok(graph.some(n => n["@type"] === "Product"));
    const faq = all.find(n => attr(n, "id") === "product-faq");
    const schema = graph.find(n => n["@type"] === "FAQPage");
    const questions = sku.faq || [];
    if (!questions.length) {
      assert.equal(faq, undefined);
      assert.equal(schema, undefined);
    } else {
      assert.ok(faq && schema, path);
      assert.equal(attr(walk(faq).find(n => n.tagName === "h2"), "id"), "product-faq-title");
      const sections = all.filter(n => n.tagName === "section");
      const index = sections.indexOf(faq);
      assert.equal(attr(sections[index - 1], "aria-labelledby"), "usage-title");
      if (sku.downloads?.length) assert.equal(attr(sections[index + 1], "id"), "resources");
      assert.equal(schema.mainEntity.length, questions.length);
      assert.equal(schema["@id"], `${publicUrl}#product-faq`);
      const details = walk(faq).filter(n => n.tagName === "details");
      assert.equal(details.length, questions.length);
      details.forEach((detail, i) => {
        const expected = questions[i];
        const nodes = walk(detail);
        const heading = nodes.find(n => n.tagName === "h3");
        assert.ok(content(heading).endsWith(expected.question[language]));
        assert.ok(!walk(heading).some(n => n.tagName === "a"));
        assert.deepEqual(nodes.filter(n => n.tagName === "p").map(content), expected.paragraphs.map(p => normalize(p[language])));
        assert.equal(schema.mainEntity[i].name, expected.question[language]);
        assert.equal(schema.mainEntity[i].acceptedAnswer.text, expected.paragraphs.map(p => p[language]).join("\n\n"));
        const expectedLinks = expected.paragraphs.flatMap(p => linkGlossaryText(p[language], language, "paragraph")).filter(s => s.slug).map(s => s.slug);
        const links = nodes.filter(n => n.tagName === "a" && attr(n, "data-glossary-link"));
        assert.deepEqual(links.map(n => attr(n, "data-glossary-link")), expectedLinks);
        for (const anchor of links) {
          const slug = attr(anchor, "data-glossary-link");
          const href = `${prefix}${glossaryPath(slug, language)}`;
          assert.equal(attr(anchor, "href"), href);
          assert.ok((backlinks[language][slug] || []).some(page => page.href === path), `${path}: missing reverse association for ${slug}`);
          targets.set(href, { slug, language });
        }
      });
    }
    pages.push({ path, faqItems: questions.length, canonical: link("canonical"), robots: meta("robots"), passed: true });
  }
}
for (const [path, { language }] of targets) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(response.status, 200, `${path}: glossary link must resolve directly`);
  const all = walk(parse(await response.text()));
  assert.equal(attr(all.find(n => n.tagName === "html"), "lang"), language === "en" ? "en" : "zh-CN");
}
const report = { pages, directGlossaryTargets: [...targets.keys()], checks: ["canonical/hreflang", "title, description and H1", "FAQ placement and server-rendered answers", "visible text equals FAQ Schema", "translated glossary links resolve without redirects", "glossary reverse associations"] };
await fs.mkdir("output/product-faq-seo", { recursive: true });
await fs.writeFile("output/product-faq-seo/audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(`PASS: ${pages.length} localized product pages, ${pages.filter(p => p.faqItems).length} FAQ pages, ${targets.size} direct glossary targets; SEO, content and backlinks match.`);
