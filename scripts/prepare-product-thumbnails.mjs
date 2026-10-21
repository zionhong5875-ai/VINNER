import sharp from "sharp";
import { mkdir, copyFile, access } from "node:fs/promises";
import { resolve } from "node:path";

// Crop source whitespace, then give every card the same 2:1 canvas and 90% fit box.
// Original files remain untouched; no per-product rendering overrides are needed.
const sources = [
  ["VLBBW8_Assets/VLBBW8_Pic1.png", "vlbbw"],
  ["VLBBG8_Asssets/VLBBG8_Pic1.png", "vlbbg"],
  ["VLSHMC1_Assests/VLSHMC1_Pic1.png", "vlshmc"],
  ["VLCONCW25_Assests/VLCONCW_Pic1.png", "vlconcw"],
  ["HKPWW60_Assests/HKPWW60_Pic1.png", "hkpww"],
];
const surfaceOriginal = "assets/product-originals/surface-disinfectant-wipes.jpg";
if (process.argv[2]) {
  await mkdir("assets/product-originals", { recursive: true });
  try { await access(surfaceOriginal); }
  catch { await copyFile(resolve(process.argv[2]), surfaceOriginal); }
}
sources.push([surfaceOriginal, "surface-disinfectant-wipes"]);
await mkdir("public/assets/product-thumbnails", { recursive: true });
for (const [source, name] of sources) {
  const { data, info } = await sharp(source).rotate().flatten({ background: "white" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = new Uint32Array(info.height);
  const columns = new Uint32Array(info.width);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < 225) { rows[y]++; columns[x]++; }
    }
  }
  const xs = [...columns.keys()].filter(x => columns[x] > info.height * .005);
  const ys = [...rows.keys()].filter(y => rows[y] > info.width * .005);
  if (!xs.length || !ys.length) throw new Error(`No product found: ${source}`);
  // Small safety margin preserves seams, shadows and antialiasing at package edges.
  const pad = Math.ceil(Math.max(info.width, info.height) * .004);
  const left = Math.max(0, xs[0] - pad), top = Math.max(0, ys[0] - pad);
  const right = Math.min(info.width, xs.at(-1) + pad + 1), bottom = Math.min(info.height, ys.at(-1) + pad + 1);
  const crop = { left, top, width: right - left, height: bottom - top };
  const product = await sharp(source).rotate().flatten({ background: "white" }).extract(crop)
    .resize(1080, 540, { fit: "inside" }).png().toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: 1200, height: 600, channels: 3, background: "white" } })
    .composite([{ input: product.data, left: Math.round((1200 - product.info.width) / 2), top: Math.round((600 - product.info.height) / 2) }])
    .png().toFile(`public/assets/product-thumbnails/${name}.png`);
  console.log(`${name}: crop ${JSON.stringify(crop)} → 1200×600, subject ${product.info.width}×${product.info.height}`);
}
