import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import faq from "../src/data/site/faq.json" with { type: "json" };

test("all five FAQs have complete matching bilingual answers and valid inline link tokens", () => {
  assert.equal(faq.items.length, 5);
  for (const item of faq.items) {
    assert.ok(item.question.zh && item.question.en);
    assert.ok(item.paragraphs.length);
    for (const paragraph of item.paragraphs) {
      assert.ok(paragraph.zh && paragraph.en);
      const tokens = value => value.match(/\{\{\w+\}\}/g) || [];
      assert.deepEqual(tokens(paragraph.zh), tokens(paragraph.en));
      for (const token of tokens(paragraph.zh)) assert.match(token, /^\{\{(partners|form|contacts)\}\}$/);
    }
  }
});

test("both pages reuse the component and linked sections have stable anchors", async () => {
  for (const path of ["src/pages/index.astro", "src/pages/about/vinner.astro"]) {
    assert.match(await readFile(path, "utf8"), /<FaqSection\s*\/>/);
  }
  assert.match(await readFile("src/components/PartnersSection.astro", "utf8"), /id="partners"/);
  assert.match(await readFile("src/components/ContactForm.astro", "utf8"), /id="contact"/);
  assert.match(await readFile("src/pages/contact.astro", "utf8"), /id="contacts"/);
});
