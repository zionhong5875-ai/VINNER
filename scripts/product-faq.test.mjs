import test from "node:test";
import assert from "node:assert/strict";
import products from "../src/data/site/products.json" with { type: "json" };
import { buildProductFaqSchema, buildFaqSchema } from "../src/utils/productFaq.mjs";
import { linkGlossaryText, glossaryLinkTargets } from "../src/utils/glossary-links.mjs";

const sku = products.lines.flatMap(line => line.skus || []).find(sku => sku.slug === "vinnerlove-rinse-free-bathing-wipes");
test("service FAQ schema resolves bilingual inline links to visible labels", () => {
  const items = [{ question: { zh: "产品？", en: "Products?" }, paragraphs: [{ zh: "查看 {{products}}。", en: "See {{products}}." }] }];
  const links = { products: { href: "/products/", label: { zh: "产品页面", en: "our product page" } } };
  for (const language of ["zh", "en"]) {
    const [schema] = buildFaqSchema(items, "https://example.test/oem-services/", language, { idPrefix: "oem-faq", links });
    assert.equal(schema["@id"], "https://example.test/oem-services/#oem-faq");
    assert.equal(schema.mainEntity[0].acceptedAnswer.text, language === "zh" ? "查看 产品页面。" : "See our product page.");
    assert.ok(!/\{\{|<a\b/.test(schema.mainEntity[0].acceptedAnswer.text));
  }
});
test("product FAQ structured data preserves all visible bilingual answers for 1–10 items", () => {
  for (let count = 1; count <= 10; count++) {
    const items = Array.from({ length: count }, (_, index) => sku.faq[index % sku.faq.length]);
    for (const language of ["zh", "en"]) {
      const [schema] = buildProductFaqSchema(items, "https://example.test/product/", language);
      assert.equal(schema.mainEntity.length, count);
      schema.mainEntity.forEach((question, index) => {
        assert.equal(question.name, items[index].question[language]);
        assert.equal(question.acceptedAnswer.text, items[index].paragraphs.map(p => p[language]).join("\n\n"));
      });
    }
  }
  assert.deepEqual(buildProductFaqSchema([], "https://example.test/product/", "en"), []);
  assert.equal(sku.faq.length, 8);
  assert.ok(sku.faq[3].paragraphs[0].zh.includes("自然干燥"));
  assert.ok(sku.faq.every(item => !JSON.stringify(item).includes("VIINNERLOVE")));
});

test("product FAQ answers link published terms without changing text or adding markup to Schema", () => {
  for (const language of ["zh", "en"]) {
    const linked = new Set();
    for (const item of sku.faq) for (const paragraph of item.paragraphs) {
      const segments = linkGlossaryText(paragraph[language], language, "paragraph");
      assert.equal(segments.map(s => s.text).join(""), paragraph[language]);
      for (const segment of segments.filter(s => s.slug)) {
        assert.ok(glossaryLinkTargets.has(segment.slug));
        linked.add(segment.slug);
      }
    }
    for (const slug of ["nonwoven-fabric", "basis-weight", "cpnp", "cpsr", "ppwr"]) assert.ok(linked.has(slug), `${language}: missing ${slug}`);
    const [schema] = buildProductFaqSchema(sku.faq, "https://example.test/product/", language);
    assert.ok(schema.mainEntity.every(q => !/<a\b|data-glossary-link/.test(q.acceptedAnswer.text)));
  }
});

test("GSM aliases support attached numeric units in both languages without linking inside words or excluded contexts", () => {
  for (const language of ["zh", "en"]) {
    assert.equal(linkGlossaryText("100gsm / 80 GSM", language, "paragraph").filter(s => s.slug === "basis-weight").length, 2);
    assert.ok(!linkGlossaryText("gsmith XGSM", language, "paragraph").some(s => s.slug));
    for (const context of ["heading", "label", "alt", "schema"]) assert.ok(!linkGlossaryText("100gsm", language, context).some(s => s.slug));
  }
});

test("ordinary English reach is not confused with the REACH regulation", () => {
  assert.ok(!linkGlossaryText("Keep out of reach of children.", "en", "paragraph").some(s => s.slug));
  const segments = linkGlossaryText("Meet REACH requirements and keep out of reach of children.", "en", "paragraph");
  assert.deepEqual(segments.filter(s => s.slug).map(s => ({ text: s.text, slug: s.slug })), [{ text: "REACH", slug: "reach" }]);
});
