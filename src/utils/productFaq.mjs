export function buildProductFaqSchema(items, pageUrl, language) {
  if (!items?.length) return [];
  return [{
    "@type": "FAQPage",
    "@id": `${pageUrl}#product-faq`,
    isPartOf: { "@id": `${pageUrl}#webpage` },
    inLanguage: language === "en" ? "en" : "zh-CN",
    mainEntity: items.map(item => ({
      "@type": "Question",
      name: item.question[language],
      acceptedAnswer: {
        "@type": "Answer",
        text: item.paragraphs.map(paragraph => paragraph[language]).join("\n\n")
      }
    }))
  }];
}
