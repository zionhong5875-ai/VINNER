const parseResourceDate = (value) => {
  if (typeof value !== "string") return null;

  const match = value.match(/(\d{4})\.(\d{2})(?:\.(\d{2}))?/);
  if (!match) return null;

  const [, year, month, day = "01"] = match;
  return new Date(`${year}-${month}-${day}T00:00:00`).getTime();
};

export const sortResourcesByDate = (items) => items
  .map((item, index) => ({ item, index, timestamp: parseResourceDate(item.date) }))
  .sort((a, b) => {
    if (a.timestamp !== null && b.timestamp !== null) return b.timestamp - a.timestamp;
    if (a.timestamp !== null) return -1;
    if (b.timestamp !== null) return 1;
    return a.index - b.index;
  })
  .map(({ item }) => item);

export const isDirectDownloadResource = (item) => {
  const hasFile = typeof item?.href === "string" && item.href.trim();

  // Explicit CMS access settings take precedence over legacy labels. Keep the
  // old heuristic for existing records until editors migrate them in the CMS.
  if (item?.access === "download") return Boolean(hasFile);
  if (item?.access === "contact") return false;
  if (item?.access) return false;

  const label = typeof item?.label === "string" ? item.label : item?.label?.en;
  return Boolean(
    (label === "Product Brochure" || label === "Product Manual" || item?.type === "Brochure") &&
      hasFile
  );
};

const getResourceName = (item) => {
  if (typeof item?.title === "string") return item.title;
  return item?.title?.en || item?.title?.zh || item?.label || "";
};

// Keep the stored date machine-readable; localize only its display suffix.
export const resourceDisplayDate = (value, language = "zh") => {
  if (language === "en") return value;
  return String(value || "")
    .replace(/\bNews\b/g, "新闻")
    .replace(/\bExhibition\b/g, "展会")
    .replace(/\bPartnership\b/g, "合作")
    .replace(/\bBlog(?=\d|\b)/g, "博客");
};

export const sortResourcesByAccessAndName = (items) => [...items].sort((a, b) => {
  const accessOrder = Number(isDirectDownloadResource(b)) - Number(isDirectDownloadResource(a));
  if (accessOrder !== 0) return accessOrder;

  return getResourceName(a).localeCompare(getResourceName(b), "en", { sensitivity: "base" });
});
