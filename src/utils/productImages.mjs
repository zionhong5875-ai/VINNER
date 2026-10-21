// Lists and related-product cards must use the same prepared thumbnail assets.
// Detail galleries intentionally keep their full-resolution source images.
export function getProductCardImage(sku, lineSlug) {
  if (sku.card?.image) return sku.card.image;
  if (["medikeep", "indukeep"].includes(lineSlug)) return "/assets/coming-soon.png";
  return lineSlug === "oem-odm" ? sku.image : sku.gallery?.[0]?.image || sku.image;
}

export function getProductCardAlt(sku, lineSlug) {
  if (sku.card?.alt) return sku.card.alt;
  if (sku.comingSoon && lineSlug !== "oem-odm") return sku.alt;
  return (lineSlug === "oem-odm" ? sku.alt : sku.gallery?.[0]?.alt || sku.alt) || sku.alt;
}
