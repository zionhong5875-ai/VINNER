import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import resources from "../src/data/site/resources.json" with { type: "json" };
import { linkGlossaryText } from "../src/utils/glossary-links.mjs";

const blog = resources.blogs.find(b => b.slug === "do-wet-wipes-need-ce-marking-eu");
test("Blog6 keeps its introduction only in the hero and uses a concise conclusion heading", () => {
  assert.equal(blog.repeatSummaryInBody, false);
  assert.ok(blog.body.zh && blog.body.en);
  assert.equal(blog.sections[0].heading, undefined);
  assert.ok(blog.sections[0].paragraphs[0].zh.startsWith("擦人的皮肤"));
  assert.deepEqual(blog.sections.at(-2).heading, { zh: "结语", en: "Conclusion" });
});

test("Blog6 retains its cover, two authors, 20 references and six comparison rows", () => {
  assert.ok(blog);
  assert.equal(blog.authorId, "lanny-shi");
  assert.deepEqual(blog.coauthorIds, ["zion-hong"]);
  assert.ok(existsSync(`public${blog.image}`));
  assert.equal(blog.sections.at(-1).bullets.length, 20);
  const table = blog.sections.find(s => s.table).table;
  assert.equal(table.rows.length, 6);
  assert.ok(table.rows.every(r => r.length === table.headers.length));
  assert.ok(existsSync(`public${table.download.href}`));
  assert.ok(blog.sections.some(s => s.productLineSlug === "carekeep"));
});

test("both article languages link to the intended published glossary terms", () => {
  for (const language of ["zh", "en"]) {
    const slugs = new Set();
    const walk = value => {
      if (!value || typeof value !== "object") return;
      if (typeof value[language] === "string") {
        for (const part of linkGlossaryText(value[language], language, "paragraph")) if (part.slug) slugs.add(part.slug);
      } else for (const child of Object.values(value)) walk(child);
    };
    blog.sections.filter(s => s !== blog.sections.at(-1)).forEach(walk);
    for (const slug of ["cpsr", "cpnp", "gmp", "iso-22716", "iso-13485", "eu-mdr", "eu-bpr", "eu-cosmetics-regulation"]) {
      assert.ok(slugs.has(slug), `${language}: missing ${slug}`);
    }
  }
});
