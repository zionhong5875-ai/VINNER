export function buildFaqSchema(items, pageUrl, language, { idPrefix = "faq", links = {} } = {}) {
  if (!items?.length) return [];
  return [{
    "@type": "FAQPage",
    "@id": `${pageUrl}#${idPrefix}`,
    isPartOf: { "@id": `${pageUrl}#webpage` },
    inLanguage: language === "en" ? "en" : "zh-CN",
    mainEntity: items.map(item => ({
      "@type": "Question",
      name: item.question[language],
      acceptedAnswer: {
        "@type": "Answer",
        text: item.paragraphs.map(paragraph => paragraph[language].replace(/\{\{(\w+)\}\}/g, (token, key) =>
          links[key] ? links[key].label[language] : token)).join("\n\n")
      }
    }))
  }];
}

export function buildProductFaqSchema(items, pageUrl, language) {
  return buildFaqSchema(items, pageUrl, language, { idPrefix: "product-faq" });
}
