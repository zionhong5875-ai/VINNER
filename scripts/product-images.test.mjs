import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import products from "../src/data/site/products.json" with { type: "json" };
import { getProductCardImage, getProductCardAlt } from "../src/utils/productImages.mjs";
import { packageBounds } from "./prepare-oem-thumbnails.mjs";

test("OEM thumbnails share one canvas and match the original unmarked package size without distortion", async () => {
  const line = products.lines.find(line => line.slug === "oem-odm");
  const reference = await packageBounds(`public${line.skus[0].image}`);
  const referenceScale = Math.min(1200 / reference.sourceWidth, 600 / reference.sourceHeight);
  const expectedWidth = reference.width * referenceScale;
  for (const sku of line.skus) {
    const path = getProductCardImage(sku, line.slug);
    assert.match(path, /^\/assets\/product-thumbnails\/oem\//);
    assert.notEqual(path, sku.image);
    const png = readFileSync(`public${path}`);
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 600);
    assert.deepEqual(getProductCardAlt(sku, line.slug), sku.alt);
    const source = await packageBounds(`public${sku.image}`);
    const output = await packageBounds(`public${path}`);
    assert.ok(Math.abs((output.width / output.height) / (source.width / source.height) - 1) < .01, `${sku.slug}: distorted package`);
    assert.ok(Math.abs(output.left + output.width / 2 - 600) < 2, `${sku.slug}: not centered`);
    if (source.width > source.height) assert.ok(Math.abs(output.width - expectedWidth) < 3, `${sku.slug}: package size differs from reference`);
    else assert.ok(output.height <= 401, `${sku.slug}: portrait package exceeds fit box`);
  }
});

test("all care cards select prepared 1200×600 thumbnails, not old gallery originals", () => {
  const care = products.lines.find(line => line.slug === "carekeep");
  assert.equal(care.skus.length, 5);
  for (const sku of care.skus) {
    const path = getProductCardImage(sku, care.slug);
    assert.equal(path, sku.card.image);
    assert.match(path, /^\/assets\/product-thumbnails\//);
    assert.notEqual(path, sku.image);
    assert.ok(existsSync(`public${path}`));
    const png = readFileSync(`public${path}`);
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 600);
    assert.ok(getProductCardAlt(sku, care.slug));
  }
});

test("shared thumbnail selection preserves upcoming and OEM fallback rules", () => {
  const sku = { image: "/source.png", alt: { zh: "产品", en: "Product" }, gallery: [{ image: "/gallery.png" }] };
  assert.equal(getProductCardImage(sku, "medikeep"), "/assets/coming-soon.png");
  assert.equal(getProductCardImage(sku, "indukeep"), "/assets/coming-soon.png");
  assert.equal(getProductCardImage(sku, "oem-odm"), "/source.png");
  assert.equal(getProductCardImage(sku, "carekeep"), "/gallery.png");
  assert.equal(getProductCardImage({ ...sku, card: { image: "/prepared.png" } }, "medikeep"), "/prepared.png");
});

test("related cards and series cards use shared thumbnail selection and media styles", () => {
  const detail = readFileSync("src/pages/products/[slug].astro", "utf8");
  const series = readFileSync("src/pages/products/series/[slug].astro", "utf8");
  const card = readFileSync("src/components/ProductCard.astro", "utf8");
  assert.match(detail, /getProductCardImage\(item, lineMeta.slug\)/);
  assert.match(series, /getProductCardImage\(sku, meta.slug\)/);
  assert.match(detail, /figure class="product-card-media"/);
  assert.match(card, /series-product-media product-card-media/);
});
