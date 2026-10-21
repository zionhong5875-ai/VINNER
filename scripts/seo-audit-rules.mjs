export function validateBlogAuthors({ blog, authors, language, origin, organizationId, schemaAuthor, bylines, metaAuthor }) {
  const errors = [];
  const ids = [...new Set([blog.authorId, ...(blog.coauthorIds || [])])];
  if (ids.some(id => !id || !authors[id])) return ["blog has an unregistered author"];
  const people = Array.isArray(schemaAuthor) ? schemaAuthor : schemaAuthor ? [schemaAuthor] : [];
  if (people.length !== ids.length) errors.push("author schema count mismatch");
  if (bylines.length !== ids.length) errors.push("visible byline count mismatch");
  ids.forEach((id, index) => {
    const author = authors[id];
    const person = people[index];
    const byline = bylines[index];
    if (person?.["@type"] !== "Person" || person?.name !== author.name[language] || person?.jobTitle !== author.role[language]) errors.push(`incorrect author name, type or job title: ${id}`);
    if (person?.["@id"] !== `${origin}/#person-${id}` || person?.url !== `${origin}${language === "en" ? "/en" : ""}/contact/#${id}` || person?.worksFor?.["@id"] !== organizationId) errors.push(`author identity or affiliation mismatch: ${id}`);
    if (byline?.name !== author.name[language] || byline?.role !== author.role[language]) errors.push(`visible byline differs from author schema: ${id}`);
  });
  if (metaAuthor !== authors[blog.authorId].name[language]) errors.push("author meta mismatch");
  return errors;
}

const attr = (node, key) => node?.attrs?.find(item => item.name === key)?.value;
const classes = node => (attr(node, "class") || "").split(/\s+/);

export function isApprovedComingSoon(node, value, upcomingSlugs) {
  if (!/^(?:COMING SOON|敬请期待)$/i.test(value.trim())) return false;
  const label = node.parentNode;
  const labelClasses = classes(label);
  if (!labelClasses.includes("series-product-code") &&
      !(labelClasses.includes("sku-card-link") && attr(label, "aria-disabled") === "true")) return false;
  for (let parent = label; parent; parent = parent.parentNode) {
    if (parent.tagName === "article") {
      return classes(parent).includes("is-upcoming") && upcomingSlugs.has(attr(parent, "data-product-slug"));
    }
  }
  return false;
}
