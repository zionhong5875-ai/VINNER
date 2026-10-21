# 知识与术语内容维护

正式内容来自 `Glossary/工厂资质术语表.docx`、`Glossary/检测标准术语表.docx`、`Glossary/湿巾知识术语表.docx` 和 `Glossary/法律法规术语表.docx`，目前包含工厂资质、测试标准、湿巾知识和法律法规四个分类。中文定义与参考文献保留文档内容；英文包含完整译文和部分简释。没有“为什么重要？”内容的文档使用 `showImportance: false`。原文中的 `<sup>` 标记转换为可点击的引用上标，文档标题的序号不作为网站术语名称。

## 增加正式术语

在 `src/data/site/glossary.json` 增加一个条目即可复用详情模板：

- `slug`：唯一英文地址，例如 `iso-9001`。
- `category`：`factory`（工厂资质）、`testing`（测试标准）、`regulations`（法律法规）或 `fundamentals`（湿巾知识）。
- `title`、`summary`：分别提供 `zh`、`en`。
- `definition`、`importance`：分别提供 `zh`、`en` 段落数组。
- `references`：按 `[1]`、`[2]` 顺序填写参考文献。正文中相同编号自动链接到本页对应文献。
- 相关页面不再填写 `relatedPages`。构建前自动扫描最终中英文 HTML 的正文术语链接，生成 `src/generated/glossary-backlinks.json`；开发服务启动及内容变更时自动刷新。不要手工修改生成文件。

新增内容会自动出现在资源页四分类词云、术语库、其他术语推荐、双语详情路由和站点地图中。列表按英文标题 A–Z 排序；中文页面同时显示英文名以解释首字母筛选。详情页的“其他术语”复用完整术语库，默认选中当前词条所属分类；Reset 清空搜索、分类和首字母，恢复全部词条。列表标题随分类及首字母实时更新。

## 模板与示例内容

`src/pages/resources/glossary/[slug].astro` 是统一详情模板；`src/components/GlossaryBrowser.astro` 复用搜索和筛选；`GlossaryParagraphs.astro` 安全地渲染段落与引用，不执行文档中的 HTML。

术语库和详情页的“其他知识与术语”目前只显示 `src/data/site/glossary.json` 中的正式词条。早期测试内容仍保存在 `src/data/site/glossary-samples.json` 作为参考，但不会显示在官网页面中。

相关卡片容器支持横向滚动和键盘操作，左右按钮在没有更多卡片时禁用。同一来源页面去重；没有来源时显示“尚无页面提及该术语，但该术语仍是重要概念。”，不显示空轮播。

验证：`npm run build`；启动本地预览后运行 `node tmp/check-glossary.mjs` 可检查正式术语库中全部 45 个术语的双语页面、正文、引用、分类入口和相关链接。

自动化验证：`npm run test:backlinks`、`npm run audit:backlinks`。生成失败会阻止生产构建，避免发布陈旧关联；生成期间不抓取术语页，不通过页面访问顺序积累关系。
