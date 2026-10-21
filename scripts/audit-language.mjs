import fs from 'node:fs';
import { parse } from 'parse5';
import { localizedSearchPaths } from '../src/utils/search-routes.mjs';
import products from '../src/data/site/products.json' with { type: 'json' };
import { isApprovedComingSoon } from './seo-audit-rules.mjs';

const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4321';
const issues = [], exceptions = [], results = [];
const upcomingSlugs = new Set(products.lines.flatMap(line => line.skus || []).filter(sku => sku.comingSoon).map(sku => sku.slug));
const han = /\p{Script=Han}/u;
const attr = (n, k) => n.attrs?.find(a => a.name === k)?.value;
const content = n => n.nodeName === '#text' ? n.value : (n.childNodes || []).map(content).join(' ');
const walk = (n, fn) => { fn(n); n.childNodes?.forEach(c => walk(c, fn)); };
const ancestor = (n, fn) => { for (let p = n.parentNode; p; p = p.parentNode) if (fn(p)) return true; return false; };
for (const path of localizedSearchPaths) {
  const en = path.startsWith('/en/');
  const glossary = /\/resources\/glossary\//.test(path);
  const response = await fetch(new URL(path, base));
  const doc = parse(await response.text());
  let images = 0;
  const add = (kind, value, node) => {
    const protectedContent = glossary && ancestor(node, p => p.tagName === 'main');
    (protectedContent ? exceptions : issues).push({ path, kind, value: value.slice(0, 400) });
  };
  if (response.status !== 200) issues.push({ path, kind: 'HTTP', value: response.status });
  walk(doc, n => {
    if (n.tagName === 'img') {
      images++;
      if (attr(n, 'alt') === undefined) add('missing alt', attr(n, 'src') || '', n);
    }
    for (const k of ['alt', 'aria-label', 'title', 'placeholder']) {
      const v = attr(n, k);
      if (v?.includes('[object Object]')) add('object attribute', `${k}: ${v}`, n);
      if (en && v && han.test(v)) add('Chinese attribute on English page', `${k}: ${v}`, n);
      if (!en && v && !han.test(v) && /\b(?:partner logo|carousel|navigation|attachments|Show (?:slide|product)|Product links|Company links|Resource links|Policy links|Read |View |coming soon|Product Manual|Safety Data Sheet)\b/i.test(v)) add('English interface attribute on Chinese page', `${k}: ${v}`, n);
    }
    if (n.nodeName === '#text' && !ancestor(n, p => ['script', 'style'].includes(p.tagName))) {
      const v = n.value.trim();
      if (en && han.test(v) && v !== '中') add('Chinese text on English page', v, n);
      if (/\[object Object\]|Lorem ipsum|\bTODO\b|\bTBD\b|详情待补充|示例术语|COMING SOON|敬请期待/i.test(v) && !isApprovedComingSoon(n, v, upcomingSlugs)) add('placeholder text', v, n);
      if (!en && /\b(?:Product Manual|Wipes\/Pack|Gloves\/Pack|Cap\/Pack|wipes pack|gloves pack|cap pack|Download brochure)\b/.test(v)) add('English interface text on Chinese page', v, n);
    }
    if (n.tagName === 'script' && attr(n, 'type') === 'application/ld+json') {
      try {
        const data = JSON.parse(content(n));
        const inspect = (v, k = '') => {
          if (Array.isArray(v)) v.forEach(x => inspect(x, k));
          else if (v && typeof v === 'object') Object.entries(v).forEach(([key, val]) => inspect(val, key));
          else if (typeof v === 'string') {
            if (v.includes('[object Object]')) add('object in JSON-LD', v, n);
            if (en && ['name', 'headline', 'description', 'category', 'caption', 'value'].includes(k) && han.test(v) && !glossary) add('Chinese JSON-LD on English page', `${k}: ${v}`, n);
          }
        };
        inspect(data);
      } catch (e) { issues.push({ path, kind: 'invalid JSON-LD', value: e.message }); }
    }
  });
  results.push({ path, status: response.status, images });
}
const report = { pages: results.length, glossaryContentExcluded: true, issues, glossaryExceptions: exceptions, results };
fs.writeFileSync(process.env.AUDIT_REPORT || '/private/tmp/vinner-language-review.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pages: results.length, issues, protectedGlossaryFindings: exceptions.length }, null, 2));
if (issues.length) process.exitCode = 1;
