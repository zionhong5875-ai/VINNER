# VINNER CMS Setup

This Astro site is CMS-ready through Decap CMS. The editing entry is `/admin/`.

## What editors can change

- Site settings, navigation text, Footer, social links, and WeChat QR code
- Homepage hero, company intro, metrics, R&D section, product-line section, partners, news, and blog headings
- Product lines, series-page copy, SKU cards, product images, specifications, gallery images, SDS, Brochure, and downloads
- About Vinner, factory introduction, factory qualification certificates, and contact-page content
- News, blog cards, digital resource cards, and PDF downloads such as SDS files
- Legal policy text

## Local editing

### Product FAQs

Under **产品与 SKU → 产品线与 SKU → SKU → 产品常见问题（FAQ）**, add up to 10 bilingual questions and answer paragraphs. The reusable module appears between Use protocol and Resource access only when questions exist. It uses two columns on larger screens and one column on phones; an odd final question fills the available row. Questions start collapsed and reuse the home FAQ animation and rotating plus icon. Visible answers and localized FAQ structured data come from the same SKU `faq` field. Product answers automatically link approved glossary aliases using `GlossaryLinkedText`; question headings and Schema remain plain text. After adding FAQ copy, review actual bilingual term links and the generated glossary backlinks, then check the new content's headings, server rendering, FAQ Schema, canonical/hreflang, and build output. This is the standard workflow for subsequent products.

### Shared product-line images

Edit the series image and bilingual Alt under **产品与 SKU → 产品线与 SKU** (source: `src/data/site/products.json`). Homepage product cards, the products overview, the series Hero, related-product-line article cards, and series social/structured metadata use this data directly. Update the optional original width and height when replacing an image of a different size.

Homepage carousel slides and article related-page windows can select **共用产品线主图** (`productLine`, e.g. `carekeep`). This inherits the same image, dimensions, and bilingual Alt automatically; leave their independent image/Alt fields empty. Unreferenced slides and windows still require their own image and bilingual Alt. Publishing validation rejects unknown references and conflicting duplicate fields. The OBM slide and cleansing-care related-page window use this shared reference.

Decap CMS supports local editing during development:

```bash
npm run dev
```

Then open:

```text
http://localhost:4321/admin/
```

For full local CMS editing, run Decap's local backend in another terminal:

```bash
npx decap-server
```

## GitHub editing

Production CMS editing needs a GitHub repository and a Decap/GitHub OAuth setup. Update `public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: YOUR_ORG/YOUR_REPO
  branch: main
```

For non-technical staff, deploy the site and give them access to:

```text
https://YOUR_DOMAIN/admin/
```

They can update JSON-backed content under `src/data/` and upload media without touching code.

## Production login

The CMS uses GitHub OAuth on EdgeOne Pages:

```yaml
site_domain: vinnercare.com
base_url: https://vinnercare.com
auth_endpoint: oauth
```

If the final production domain is different, update these two values in `public/admin/config.yml` and redeploy:

- `site_domain`
- `base_url`

Create a GitHub OAuth App at:

```text
https://github.com/settings/applications/new
```

Use:

```text
Homepage URL: https://vinnercare.com
Authorization callback URL: https://vinnercare.com/oauth/callback
```

Then put the Client ID and Client Secret into EdgeOne Pages environment variables:

```text
OAUTH_GITHUB_CLIENT_ID
OAUTH_GITHUB_CLIENT_SECRET
```

## Editor workflow

1. Open `/admin/`.
2. Log in with the invited GitHub account.
3. Choose `官网内容`.
4. Edit `全站设置`, `首页`, `产品与 SKU`, `关于维尼`, `工厂介绍`, `工厂资质`, `联系页面`, `新闻、博客与数字资源`, or `合规页面`.
5. To replace an image, click the image field and upload/select a file.
6. To add SDS or PDF downloads, use the `上传文件` field in `博客与资源 > 数字资源` or in a product SKU's `下载资源`.
7. Click `Publish`. The CMS commits the change to GitHub.
8. EdgeOne Pages rebuilds the website automatically after the commit.

The production build runs a CMS-content validation before Astro builds. A failed validation prevents EdgeOne Pages from promoting a broken build. The check currently protects bilingual article/product copy, unique and non-reserved slugs, blog author references, product links inside article sections, valid homepage metric icons, and download access/file settings.

## CMS automation boundaries

- News and blogs added to their lists automatically appear in resource cards, localized article routes, search routes, the sitemap, and article structured data. Article sections are optional; when omitted, the article still renders its title, image, and bilingual lead text.
- Product lines and SKUs are data-driven. A product line must contain at least one SKU. Published SKUs need bilingual descriptions, highlights, specifications, and usage steps; planned SKUs can use the coming-soon fields. New slugs must be unique and use lowercase letters, numbers, and hyphens.
- For every new resource or SKU file, choose **直接下载** or **联系获取** in `获取方式`. Direct downloads require an uploaded file. This keeps download buttons, contact requests, and the All Files view in sync without relying on labels such as “Brochure” or “Manual”.
- Homepage metric icons are dropdowns, so an unsupported icon key cannot enter through the CMS.
- CMS edits predefined data fields. It does not create new Astro pages/modules, add new CMS collection types, or manage Glossary terms and their alias/link rules. Those require a code/schema change. Blog author choices are currently Zion and Lanny only; adding an author also requires updating the author data and CMS author options.
- The contact form is intentionally code-managed rather than CMS-managed: its fields and validation live in `src/utils/contact-fields.mjs` and its server handler.
- After a CMS commit, check the EdgeOne Pages build result. The content check validates structure and required editorial fields; it does not verify factual claims, image rights, PDF contents, or that external links remain live.

For the non-technical editor handoff, use `BUSINESS_EDITOR_GUIDE.md`.

## Image rules for editors

- Use horizontal images for hero and large modules.
- Prefer 2000px wide JPG/WebP images.
- Always fill in the Alt text field.
- Avoid screenshots, watermarked images, and low-resolution product photos.
