import test from "node:test";
import assert from "node:assert/strict";
import { validateCmsContent } from "./validate-cms-content.mjs";
import { resolveProductLineMedia } from "../src/utils/productLines.js";
import { isDirectDownloadResource, resourceDisplayDate, sortResourcesByAccessAndName } from "../src/utils/resources.js";

const localized = { zh: "中文内容", en: "English content" };
const baseData = () => ({
  home: {
    company: { stats: [{ icon: "clock", label: localized, number: localized, body: localized }] },
    rd: { metrics: [{ icon: "lab", number: localized, body: localized }] }
  },
  products: {
    lines: [{
      slug: "carekeep", name: localized, title: localized, summary: localized,
      products: localized, detail: localized, indexLabel: localized,
      image: "https://example.test/line.png", alt: localized, uses: [localized],
      skus: [{
        slug: "sample-wipes", title: "Sample Wipes", code: "SKU-1", image: "https://example.test/sku.png",
        alt: "Sample wipes package", body: localized, intro: localized,
        highlights: [localized], specs: [{ label: localized, value: localized }], usage: [localized], downloads: []
      }]
    }]
  },
  resources: {
    news: [],
    blogs: [{ slug: "sample-blog", title: localized, body: localized, image: "https://example.test/blog.png", alt: localized, authorId: "zion-hong" }],
    downloads: [{ access: "contact", type: "SDS", label: "Safety Data Sheet", title: "Sample SDS", href: "" }]
  },
  authors: { "zion-hong": { name: localized, role: localized } }
});

test("carousel and related-page windows follow a product-line image replacement and translated Alt together", () => {
  const data = baseData();
  const slide = { productLine: "carekeep", title: localized, body: localized };
  const window = { productLine: "carekeep", href: "/products/series/cleansing-care/", kicker: localized, title: localized, body: localized, link: localized };
  data.home.hero = { slides: [slide] };
  data.resources.blogs[0].sections = [{ pageWindow: window }];
  assert.deepEqual(validateCmsContent(data), []);
  const line = data.products.lines[0];
  line.image = "https://example.test/replacement.webp";
  line.alt = { zh: "新的产品组合", en: "Updated product range" };
  line.imageWidth = 1492;
  line.imageHeight = 1054;
  for (const placement of [slide, window]) {
    const media = resolveProductLineMedia(placement, data.products.lines);
    assert.equal(media.image, line.image);
    assert.deepEqual(media.alt, line.alt);
    assert.equal(media.imageWidth, 1492);
    assert.equal(media.imageHeight, 1054);
  }
});

test("publishing rejects stale duplicate media fields and missing product-line references", () => {
  const data = baseData();
  data.home.hero = { slides: [{ productLine: "missing", image: "/stale.webp", alt: localized, title: localized, body: localized }] };
  const errors = validateCmsContent(data).join("\n");
  assert.match(errors, /unknown product-line media reference/);
  assert.match(errors, /must not duplicate image or alt/);
  assert.throws(() => resolveProductLineMedia({ productLine: "missing" }, data.products.lines), /Unknown product-line/);
});

test("allows a blog article with no optional sections", () => {
  assert.deepEqual(validateCmsContent(baseData()), []);
});

test("product FAQs accept 1–10 bilingual items and reject incomplete or oversized lists", () => {
  for (let count = 1; count <= 10; count++) {
    const data = baseData();
    data.products.lines[0].skus[0].faq = Array.from({ length: count }, () => ({ question: localized, paragraphs: [localized] }));
    assert.deepEqual(validateCmsContent(data), []);
  }
  for (const value of ["invalid", Array(11).fill({ question: localized, paragraphs: [localized] }), [{ question: { zh: "问题" }, paragraphs: [] }]]) {
    const data = baseData();
    data.products.lines[0].skus[0].faq = value;
    assert.match(validateCmsContent(data).join("\n"), /\.faq/);
  }
});

test("rejects duplicate or reserved article routes and invalid product references", () => {
  const data = baseData();
  data.resources.news = [{ slug: "sample-blog", title: localized, body: localized, image: "/news.png", alt: "News" }];
  data.resources.blogs[0].sections = [{ productSlug: "missing-sku" }];
  const errors = validateCmsContent(data).join("\n");
  assert.match(errors, /duplicate article slug/);
  assert.match(errors, /product "missing-sku" does not exist/);
});

test("rejects empty product lines and unsupported homepage icon keys", () => {
  const data = baseData();
  data.products.lines[0].skus = [];
  data.home.company.stats[0].icon = "typo-icon";
  const errors = validateCmsContent(data).join("\n");
  assert.match(errors, /add at least one SKU/);
  assert.match(errors, /choose a supported icon/);
});

test("requires direct-download files and an explicit access mode", () => {
  const data = baseData();
  data.resources.downloads = [{ access: "download", title: "Missing PDF", href: "" }];
  const errors = validateCmsContent(data).join("\n");
  assert.match(errors, /direct-download resources need an uploaded file/);
  assert.equal(isDirectDownloadResource({ access: "contact", label: "Product Manual", href: "/manual.pdf" }), false);
  assert.equal(isDirectDownloadResource({ access: "download", label: "Safety Data Sheet", href: "/sds.pdf" }), true);
});

test("rejects CMS media and file references that are absent from public assets", () => {
  const data = baseData();
  data.resources.blogs[0].image = "/assets/uploads/missing-blog-cover.png";
  data.resources.downloads = [{ access: "download", title: "Missing PDF", href: "/assets/uploads/missing-manual.pdf" }];
  const errors = validateCmsContent(data).join("\n");
  assert.match(errors, /public asset "\/assets\/uploads\/missing-blog-cover\.png" does not exist/);
  assert.match(errors, /public asset "\/assets\/uploads\/missing-manual\.pdf" does not exist/);
});

test("reports malformed nested CMS lists without crashing the validator", () => {
  const data = baseData();
  data.products.lines[0].skus[0].specs = "not a list";
  data.resources.blogs[0].sections = [{ subsections: "not a list" }];
  const errors = validateCmsContent(data).join("\n");
  assert.match(errors, /skus\[0\]\.specs: use a list/);
  assert.match(errors, /sections\[0\]\.subsections: use a list/);
});

test("legacy resource labels remain readable during CMS migration", () => {
  assert.equal(isDirectDownloadResource({ label: "Product Manual", href: "/manual.pdf" }), true);
  assert.equal(isDirectDownloadResource({ label: "Safety Data Sheet", href: "" }), false);
});

test("bilingual download names and labels retain access rules and ordering", () => {
  const manual = { label: { zh: "产品手册", en: "Product Manual" }, title: { zh: "沐浴湿巾手册", en: "Bathing wipes manual" }, href: "/manual.pdf" };
  const sds = { access: "contact", label: { zh: "安全数据表", en: "Safety Data Sheet" }, title: { zh: "安全数据表", en: "Safety Data Sheet" }, href: "" };
  assert.equal(isDirectDownloadResource(manual), true);
  assert.equal(isDirectDownloadResource(sds), false);
  assert.deepEqual(sortResourcesByAccessAndName([sds, manual]), [manual, sds]);
});

test("display dates translate labels without changing publication dates", () => {
  assert.equal(resourceDisplayDate("2026.09.22 / Blog005", "zh"), "2026.09.22 / 博客005");
  assert.equal(resourceDisplayDate("2026.02.09 / Exhibition", "en"), "2026.02.09 / Exhibition");
});
