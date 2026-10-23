import fs from "node:fs";
import { youtubeEmbed } from "../src/utils/video.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supportedMetricIcons = new Set([
  "clock", "years", "medical", "automation", "capacity",
  "investment", "formula", "network", "patent", "lab"
]);
const articleReservedSlugs = new Set(["all", "blogs", "news", "files", "glossary"]);
const skuReservedSlugs = new Set(["series"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetFields = new Set(["image", "href", "logo", "icon", "thumb", "wechatQr", "videoPoster"]);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const hasLocalizedText = (value) => hasText(value) || (
  value && typeof value === "object" && hasText(value.zh) && hasText(value.en)
);
const hasBilingualText = (value) => (
  value && typeof value === "object" && hasText(value.zh) && hasText(value.en)
);

function validateLocalAssets(errors, value, itemPath = "content") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateLocalAssets(errors, entry, `${itemPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${itemPath}.${key}`;
    if (assetFields.has(key) && typeof entry === "string" && entry.startsWith("/assets/")) {
      let localPath;
      try {
        localPath = path.resolve(projectRoot, "public", `.${decodeURIComponent(entry)}`);
      } catch {
        errors.push(`${entryPath}: asset path is not a valid URL-encoded path.`);
        continue;
      }
      const publicRoot = path.resolve(projectRoot, "public");
      if (!localPath.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(localPath)) {
        errors.push(`${entryPath}: public asset "${entry}" does not exist.`);
      }
    }
    validateLocalAssets(errors, entry, entryPath);
  }
}

function addUniqueSlug(errors, seen, slug, label, path) {
  if (!hasText(slug) || !slugPattern.test(slug)) {
    errors.push(`${path}: ${label} must be a lowercase URL slug (letters, numbers, hyphens).`);
    return;
  }
  if (seen.has(slug)) errors.push(`${path}: duplicate ${label} "${slug}" (also used by ${seen.get(slug)}).`);
  else seen.set(slug, path);
}

function validateLocalizedList(errors, entries, path) {
  if (!Array.isArray(entries)) {
    errors.push(`${path}: use a list.`);
    return;
  }
  entries.forEach((entry, index) => {
    if (!hasLocalizedText(entry)) errors.push(`${path}[${index}]: provide localized text.`);
  });
}

function validateDownload(errors, item, path) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    errors.push(`${path}: download entry must be an object.`);
    return;
  }
  if (!hasText(item.access) || !["download", "contact"].includes(item.access)) {
    errors.push(`${path}.access: choose "download" or "contact" in the CMS.`);
  }
  if (item.access === "download" && !hasText(item.href)) {
    errors.push(`${path}.href: direct-download resources need an uploaded file.`);
  }
  if (!hasLocalizedText(item.title)) errors.push(`${path}.title: add a title.`);
}

export function validateCmsContent({ home, products, resources, authors }) {
  const errors = [];
  const articleSlugs = new Map();
  const productLineSlugs = new Map();
  const skuSlugs = new Map();
  const referencedProductSlugs = [];

  const validateSharedMedia = (entry, itemPath) => {
    if (entry.productLine) {
      if (!(products?.lines || []).some((line) => line.slug === entry.productLine)) {
        errors.push(`${itemPath}.productLine: unknown product-line media reference "${entry.productLine}".`);
      }
      if (entry.image || entry.alt) errors.push(`${itemPath}: shared product-line media must not duplicate image or alt fields.`);
    } else {
      if (!hasText(entry.image)) errors.push(`${itemPath}.image: add an image or choose a product-line reference.`);
      if (!hasBilingualText(entry.alt)) errors.push(`${itemPath}.alt: provide Chinese and English image descriptions.`);
    }
  };
  for (const [index, slide] of (home?.hero?.slides || []).entries()) {
    validateSharedMedia(slide, `home.hero.slides[${index}]`);
    for (const field of ["title", "body"]) {
      if (!hasBilingualText(slide[field])) errors.push(`home.hero.slides[${index}].${field}: provide Chinese and English text.`);
    }
  }

  if (!Array.isArray(resources?.news) || !Array.isArray(resources?.blogs)) {
    errors.push("resources.json: news and blogs must both be lists.");
  }

  for (const kind of ["news", "blogs"]) {
    for (const [index, article] of (resources?.[kind] || []).entries()) {
      const itemPath = `resources.${kind}[${index}]`;
      if (!article || typeof article !== "object" || Array.isArray(article)) {
        errors.push(`${itemPath}: article must be an object.`);
        continue;
      }
      addUniqueSlug(errors, articleSlugs, article.slug, "article slug", `${itemPath}.slug`);
      if (articleReservedSlugs.has(article.slug)) {
        errors.push(`${itemPath}.slug: "${article.slug}" is reserved for a resources page.`);
      }
      for (const field of ["title", "body"]) {
        if (!hasBilingualText(article[field])) errors.push(`${itemPath}.${field}: provide both Chinese and English text.`);
      }
      if (!hasText(article.image)) errors.push(`${itemPath}.image: add a card and article image.`);
      if (!hasLocalizedText(article.alt)) errors.push(`${itemPath}.alt: add descriptive image alt text.`);
      if (article.gallery !== undefined && !Array.isArray(article.gallery)) errors.push(`${itemPath}.gallery: use a list.`);
      for (const [mediaIndex, media] of (Array.isArray(article.gallery) ? article.gallery : []).entries()) {
        if (!media || typeof media !== "object" || Array.isArray(media)) errors.push(`${itemPath}.gallery[${mediaIndex}]: image must be an object.`);
        else {
          if (!hasText(media.image)) errors.push(`${itemPath}.gallery[${mediaIndex}].image: add an image.`);
          if (!hasLocalizedText(media.alt)) errors.push(`${itemPath}.gallery[${mediaIndex}].alt: add descriptive image alt text.`);
        }
      }
      if (kind === "blogs") {
        if (article.coauthorIds !== undefined) {
          if (!Array.isArray(article.coauthorIds)) errors.push(`${itemPath}.coauthorIds: use a list.`);
          else article.coauthorIds.forEach((id, i) => {
            if (!authors?.[id]) errors.push(`${itemPath}.coauthorIds[${i}]: choose an author defined in authors.json.`);
          });
        }
        const author = authors?.[article.authorId];
        if (!author) errors.push(`${itemPath}.authorId: choose an author defined in authors.json.`);
        else {
          if (!hasBilingualText(author.name)) errors.push(`authors.${article.authorId}.name: provide Chinese and English names.`);
          if (!hasBilingualText(author.role)) errors.push(`authors.${article.authorId}.role: provide Chinese and English roles.`);
        }
      }
      if (article.meta !== undefined) {
        if (!article.meta || typeof article.meta !== "object") {
          errors.push(`${itemPath}.meta: SEO overrides must be an object.`);
        } else {
          for (const field of ["title", "description"]) {
            if (!hasBilingualText(article.meta[field])) errors.push(`${itemPath}.meta.${field}: provide Chinese and English SEO text.`);
          }
        }
      }

      if (article.sections !== undefined && !Array.isArray(article.sections)) {
        errors.push(`${itemPath}.sections: use a list, or leave it empty; the article renderer supports no sections.`);
        continue;
      }
      for (const [sectionIndex, section] of (article.sections || []).entries()) {
        const sectionPath = `${itemPath}.sections[${sectionIndex}]`;
        if (!section || typeof section !== "object" || Array.isArray(section)) {
          errors.push(`${sectionPath}: section must be an object.`);
          continue;
        }
        for (const field of ["paragraphs", "paragraphsAfter", "bullets", "subsections", "media", "linkedParagraphs"]) {
          if (section[field] !== undefined && !Array.isArray(section[field])) {
            errors.push(`${sectionPath}.${field}: use a list.`);
          }
        }
        for (const [subsectionIndex, subsection] of (Array.isArray(section.subsections) ? section.subsections : []).entries()) {
          const subsectionPath = `${sectionPath}.subsections[${subsectionIndex}]`;
          if (!subsection || typeof subsection !== "object" || Array.isArray(subsection)) {
            errors.push(`${subsectionPath}: subsection must be an object.`);
            continue;
          }
          for (const field of ["paragraphs", "paragraphsAfter", "bullets"]) {
            if (subsection[field] !== undefined && !Array.isArray(subsection[field])) errors.push(`${subsectionPath}.${field}: use a list.`);
          }
        }
        for (const [mediaIndex, media] of (Array.isArray(section.media) ? section.media : []).entries()) {
          const mediaPath = `${sectionPath}.media[${mediaIndex}]`;
          if (!media || typeof media !== "object" || Array.isArray(media)) errors.push(`${mediaPath}: media must be an object.`);
          else {
            if (!hasText(media.image)) errors.push(`${mediaPath}.image: add an image.`);
            if (!hasLocalizedText(media.alt)) errors.push(`${mediaPath}.alt: add descriptive image alt text.`);
          }
        }
        if (section.pageWindow !== undefined) {
          const window = section.pageWindow;
          if (!window || typeof window !== "object" || Array.isArray(window)) errors.push(`${sectionPath}.pageWindow: related-page window must be an object.`);
          else {
            validateSharedMedia(window, `${sectionPath}.pageWindow`);
            if (!hasText(window.href)) errors.push(`${sectionPath}.pageWindow.href: add a value.`);
            for (const field of ["kicker", "title", "body", "link"]) {
              if (!hasLocalizedText(window[field])) errors.push(`${sectionPath}.pageWindow.${field}: provide localized content.`);
            }
          }
        }
        for (const linked of [...(section.linkedParagraph !== undefined ? [section.linkedParagraph] : []), ...(Array.isArray(section.linkedParagraphs) ? section.linkedParagraphs : [])]) {
          if (!linked || typeof linked !== "object" || Array.isArray(linked)) errors.push(`${sectionPath}.linkedParagraph: linked paragraph must be an object.`);
          else {
            if (!hasText(linked.href)) errors.push(`${sectionPath}.linkedParagraph.href: add a destination.`);
            if (!hasLocalizedText(linked.text)) errors.push(`${sectionPath}.linkedParagraph.text: add localized link text.`);
          }
        }
        if (section.table !== undefined && section.table !== null) {
          if (!Array.isArray(section.table.headers) || !Array.isArray(section.table.rows)) {
            errors.push(`${sectionPath}.table: add header and row lists.`);
          } else if (section.table.rows.some((row) => !Array.isArray(row) || row.length !== section.table.headers.length)) {
            errors.push(`${sectionPath}.table: every row must have the same number of cells as the header.`);
          }
        }
        if (section.productSlug) referencedProductSlugs.push([section.productSlug, `${sectionPath}.productSlug`]);
        if (section.productSlugs !== undefined) {
          if (!Array.isArray(section.productSlugs)) errors.push(`${sectionPath}.productSlugs: use a list.`);
          else section.productSlugs.forEach((slug, i) => referencedProductSlugs.push([slug, `${sectionPath}.productSlugs[${i}]`]));
        }
      }
    }
  }

  if (!Array.isArray(products?.lines)) {
    errors.push("products.json: lines must be a list.");
  }
  for (const [lineIndex, line] of (products?.lines || []).entries()) {
    const linePath = `products.lines[${lineIndex}]`;
    if (!line || typeof line !== "object" || Array.isArray(line)) {
      errors.push(`${linePath}: product line must be an object.`);
      continue;
    }
    addUniqueSlug(errors, productLineSlugs, line.slug, "product-line slug", `${linePath}.slug`);
    if (!hasBilingualText(line.indexLabel)) errors.push(`${linePath}.indexLabel: provide Chinese and English labels.`);
    for (const field of ["name", "title", "summary", "products", "detail"]) {
      if (!hasBilingualText(line[field])) errors.push(`${linePath}.${field}: provide Chinese and English text.`);
    }
    if (!hasText(line.image)) errors.push(`${linePath}.image: add a product-line image.`);
    if (!hasLocalizedText(line.alt)) errors.push(`${linePath}.alt: add descriptive image alt text.`);
    if (!Array.isArray(line.uses) || line.uses.length === 0) errors.push(`${linePath}.uses: add at least one localized application.`);
    else validateLocalizedList(errors, line.uses, `${linePath}.uses`);
    if (!Array.isArray(line.skus) || line.skus.length === 0) {
      errors.push(`${linePath}.skus: add at least one SKU; an empty line would publish an empty product page.`);
      continue;
    }

    for (const [skuIndex, sku] of line.skus.entries()) {
      const skuPath = `${linePath}.skus[${skuIndex}]`;
      if (!sku || typeof sku !== "object" || Array.isArray(sku)) {
        errors.push(`${skuPath}: SKU must be an object.`);
        continue;
      }
      addUniqueSlug(errors, skuSlugs, sku.slug, "SKU slug", `${skuPath}.slug`);
      if (skuReservedSlugs.has(sku.slug)) errors.push(`${skuPath}.slug: "${sku.slug}" is reserved for the product-series route.`);
      for (const field of ["title", "code", "image", "alt"]) {
        if (!hasLocalizedText(sku[field])) errors.push(`${skuPath}.${field}: add a value.`);
      }
      for (const field of ["body", "intro"]) {
        if (!hasBilingualText(sku[field])) errors.push(`${skuPath}.${field}: provide Chinese and English text.`);
      }
      if (!sku.comingSoon) {
        for (const field of ["highlights", "specs", "usage"]) {
          if (!Array.isArray(sku[field]) || sku[field].length === 0) {
            errors.push(`${skuPath}.${field}: published products need at least one item.`);
          }
        }
      }
      for (const field of ["highlights", "specs", "usage", "features", "applications"]) {
        if (sku[field] !== undefined && !Array.isArray(sku[field])) errors.push(`${skuPath}.${field}: use a list.`);
      }
      validateLocalizedList(errors, sku.highlights || [], `${skuPath}.highlights`);
      validateLocalizedList(errors, sku.usage || [], `${skuPath}.usage`);
      if (sku.faq !== undefined) {
        if (!Array.isArray(sku.faq) || sku.faq.length > 10) {
          errors.push(`${skuPath}.faq: use a list of up to 10 questions, or leave it empty.`);
        } else sku.faq.forEach((item, index) => {
          const faqPath = `${skuPath}.faq[${index}]`;
          if (!hasBilingualText(item?.question)) errors.push(`${faqPath}.question: provide Chinese and English text.`);
          if (!Array.isArray(item?.paragraphs) || !item.paragraphs.length) {
            errors.push(`${faqPath}.paragraphs: provide at least one bilingual answer paragraph.`);
          } else item.paragraphs.forEach((paragraph, paragraphIndex) => {
            if (!hasBilingualText(paragraph)) errors.push(`${faqPath}.paragraphs[${paragraphIndex}]: provide Chinese and English text.`);
          });
        });
      }
      for (const [specIndex, spec] of (Array.isArray(sku.specs) ? sku.specs : []).entries()) {
        const label = Array.isArray(spec) ? spec[0] : spec?.label;
        const value = Array.isArray(spec) ? spec[1] : spec?.value;
        if (!hasLocalizedText(label) || !hasLocalizedText(value)) errors.push(`${skuPath}.specs[${specIndex}]: provide localized label and value.`);
      }
      for (const field of ["features", "applications"]) {
        if (sku[field] !== undefined && Array.isArray(sku[field])) validateLocalizedList(errors, sku[field], `${skuPath}.${field}`);
      }
      if (sku.gallery !== undefined && !Array.isArray(sku.gallery)) errors.push(`${skuPath}.gallery: use a list.`);
      for (const [galleryIndex, image] of (Array.isArray(sku.gallery) ? sku.gallery : []).entries()) {
        if (!image || typeof image !== "object" || Array.isArray(image)) errors.push(`${skuPath}.gallery[${galleryIndex}]: image must be an object.`);
        else {
          if (!hasText(image.image)) errors.push(`${skuPath}.gallery[${galleryIndex}].image: add an image.`);
          if (!hasLocalizedText(image.alt)) errors.push(`${skuPath}.gallery[${galleryIndex}].alt: add descriptive image alt text.`);
        }
      }
      if (sku.downloads !== undefined && !Array.isArray(sku.downloads)) {
        errors.push(`${skuPath}.downloads: use a list.`);
      } else {
        (sku.downloads || []).forEach((download, downloadIndex) => validateDownload(errors, download, `${skuPath}.downloads[${downloadIndex}]`));
      }
    }
  }

  for (const [slug, path] of referencedProductSlugs) {
    if (!skuSlugs.has(slug)) errors.push(`${path}: product "${slug}" does not exist in products.json.`);
  }

  for (const [group, entries] of [["company.stats", home?.company?.stats], ["rd.metrics", home?.rd?.metrics]]) {
    if (!Array.isArray(entries)) {
      errors.push(`home.json ${group}: must be a list.`);
      continue;
    }
    entries.forEach((entry, index) => {
      const itemPath = `home.${group}[${index}]`;
      if (!supportedMetricIcons.has(entry?.icon)) errors.push(`${itemPath}.icon: choose a supported icon in the CMS.`);
      for (const field of ["number", "body", ...(group === "company.stats" ? ["label"] : [])]) {
        if (!hasBilingualText(entry?.[field])) errors.push(`${itemPath}.${field}: provide Chinese and English text.`);
      }
    });
  }

  if (!Array.isArray(resources?.downloads)) {
    errors.push("resources.downloads: downloads must be a list.");
  } else {
    resources.downloads.forEach((download, index) => validateDownload(errors, download, `resources.downloads[${index}]`));
  }

  validateLocalAssets(errors, home, "home");
  validateLocalAssets(errors, products, "products");
  validateLocalAssets(errors, resources, "resources");

  return errors;
}

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

export function validateCurrentCmsContent() {
  const errors = validateCmsContent({
    home: loadJson("../src/data/site/home.json"),
    products: loadJson("../src/data/site/products.json"),
    resources: loadJson("../src/data/site/resources.json"),
    authors: loadJson("../src/data/site/authors.json")
  });
  // Legacy helpers accept plain text; the current publishing data must have
  // explicit translations for every image description and presentation field.
  const inspectTranslations = (value, source) => {
    if (Array.isArray(value)) return value.forEach((entry, i) => inspectTranslations(entry, `${source}[${i}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const field = `${source}.${key}`;
      if (["alt", "imageAlt", "logoAlt", "wechatAlt", "videoTitle", "videoPosterAlt", "displayName", "displayTitle", "typeLabel", "packQuantity"].includes(key)) {
        if (!hasBilingualText(entry)) errors.push(`${field}: provide both Chinese and English text before publishing.`);
        else if (/\p{Script=Han}/u.test(entry.en)) errors.push(`${field}.en: English content contains Chinese text.`);
      }
      inspectTranslations(entry, field);
    }
  };
  for (const file of ["home", "products", "resources", "aboutVinner", "factory", "factoryQualification", "contact", "siteSettings", "oemServices"]) {
    inspectTranslations(loadJson(`../src/data/site/${file}.json`), file);
  }
  const oem = loadJson("../src/data/site/oemServices.json");
  validateLocalAssets(errors, oem, "oemServices");
  const inspectOemTranslations = (value, source) => {
    if (Array.isArray(value)) return value.forEach((entry, index) => inspectOemTranslations(entry, `${source}[${index}]`));
    if (!value || typeof value !== "object") return;
    if ("zh" in value || "en" in value) {
      if (!hasBilingualText(value)) errors.push(`${source}: provide Chinese and English text.`);
      else if (/\p{Script=Han}/u.test(value.en)) errors.push(`${source}.en: English content contains Chinese text.`);
    } else Object.entries(value).forEach(([key, entry]) => inspectOemTranslations(entry, `${source}.${key}`));
  };
  inspectOemTranslations(oem, "oemServices");
  if (oem.moq?.headers?.length !== 4 || !oem.moq.rows?.length) errors.push("oemServices.moq: provide four headers and at least one packaging row.");
  if (!oem.process?.steps?.length) errors.push("oemServices.process.steps: provide at least one step.");
  if (!oem.faq?.items?.length || oem.faq.items.length > 10) errors.push("oemServices.faq.items: provide 1–10 questions.");
  for (const [index, item] of (oem.faq?.items || []).entries()) {
    if (!hasBilingualText(item.question) || !item.paragraphs?.length) errors.push(`oemServices.faq.items[${index}]: provide a bilingual question and answer.`);
    for (const paragraph of item.paragraphs || []) for (const language of ["zh", "en"]) {
      for (const match of (paragraph[language] || "").matchAll(/\{\{(\w+)\}\}/g)) {
        if (!["oemProducts", "obmProducts"].includes(match[1])) errors.push(`oemServices.faq.items[${index}]: unknown product link ${match[1]}.`);
      }
    }
  }
  const home = loadJson("../src/data/site/home.json");
  try { youtubeEmbed(home.company.videoSrc); }
  catch (error) { errors.push(`home.company.videoSrc: ${error.message}`); }
  if (!hasText(home.company.videoPoster) || !home.company.videoPoster.startsWith('/assets/')) errors.push('home.company.videoPoster: choose a local poster image.');
  if (errors.length) throw new Error(`CMS content validation failed:\n- ${errors.join("\n- ")}`);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    validateCurrentCmsContent();
    const resources = loadJson("../src/data/site/resources.json");
    const products = loadJson("../src/data/site/products.json");
    const skuCount = products.lines.reduce((total, line) => total + line.skus.length, 0);
    console.log(`CMS content check passed: ${resources.news.length} news, ${resources.blogs.length} blogs, ${products.lines.length} product lines, ${skuCount} SKUs, ${resources.downloads.length} resource files.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
