import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Reuse the care-line approach: prepare assets, keep one shared card renderer.
// The unmarked 70% IPA reference occupies ~49% of a 2:1 card's width.
// Preserve that visual size, including original label artwork and package shape.
export const oemThumbnailLayout = { width: 1200, height: 600, subjectWidth: 583, subjectHeight: 400 };

export async function packageBounds(source) {
  const { data, info } = await sharp(source).rotate().flatten({ background: "white" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = new Uint32Array(info.height), columns = new Uint32Array(info.width);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    const low = Math.min(data[i], data[i + 1], data[i + 2]);
    const high = Math.max(data[i], data[i + 1], data[i + 2]);
    // Colored packaging only; exclude the off-white background and gray shadow.
    if (high - low > 35 && low < 225) { rows[y]++; columns[x]++; }
  }
  const xs = [...columns.keys()].filter(x => columns[x] > info.height * .005);
  const ys = [...rows.keys()].filter(y => rows[y] > info.width * .005);
  if (!xs.length || !ys.length) throw new Error(`No colored packaging found: ${source}`);
  return { left: xs[0], top: ys[0], width: xs.at(-1) - xs[0] + 1, height: ys.at(-1) - ys[0] + 1, sourceWidth: info.width, sourceHeight: info.height };
}

async function prepareOemThumbnails() {
  const products = JSON.parse(await readFile(new URL("../src/data/site/products.json", import.meta.url), "utf8"));
  const skus = products.lines.find(line => line.slug === "oem-odm").skus;
  const directory = "public/assets/product-thumbnails/oem";
  await mkdir(directory, { recursive: true });
  for (const sku of skus) {
    // sku.image remains the untouched source; sku.card.image selects the result.
    const source = `public${sku.image}`;
    const bounds = await packageBounds(source);
    const scale = Math.min(oemThumbnailLayout.subjectWidth / bounds.width, oemThumbnailLayout.subjectHeight / bounds.height);
    const edge = Math.ceil(Math.max(bounds.sourceWidth, bounds.sourceHeight) * .004);
    const left = Math.max(0, bounds.left - edge), top = Math.max(0, bounds.top - edge);
    const right = Math.min(bounds.sourceWidth, bounds.left + bounds.width + edge);
    // Keep the existing package shadow below the colored subject.
    const bottom = Math.min(bounds.sourceHeight, bounds.top + bounds.height + Math.ceil(bounds.sourceWidth * .035));
    const width = right - left, height = bottom - top;
    const scaledWidth = Math.round(width * scale), scaledHeight = Math.round(height * scale);
    const subjectLeft = Math.round((oemThumbnailLayout.width - bounds.width * scale) / 2);
    const subjectTop = Math.round((oemThumbnailLayout.height - bounds.height * scale) / 2);
    const product = await sharp(source).rotate().flatten({ background: "white" })
      .extract({ left, top, width, height }).resize(scaledWidth, scaledHeight).png().toBuffer();
    const output = `${directory}/${basename(sku.image)}`;
    await sharp({ create: { width: oemThumbnailLayout.width, height: oemThumbnailLayout.height, channels: 3, background: "white" } })
      .composite([{ input: product, left: subjectLeft - Math.round((bounds.left - left) * scale), top: subjectTop - Math.round((bounds.top - top) * scale) }])
      .png().toFile(output);
    console.log(`${sku.slug}: ${Math.round(bounds.width * scale)}×${Math.round(bounds.height * scale)} subject → 1200×600`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareOemThumbnails();
