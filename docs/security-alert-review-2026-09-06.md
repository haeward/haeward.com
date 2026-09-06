# Dependabot 警报评估与修复（2026-09-06）

## 范围与结论

检查对象为 `haeward/haeward.com` 默认分支上的 29 个 open alerts：
17 个 High、9 个 Medium、3 个 Low，涉及 11 个依赖包。
其中 Astro、RSS 和 Sharp 的部分漏洞同时出现在 manifest 和 lockfile 中，
因此 29 个警报对应 24 个不同的 GHSA，并不是 29 个不同漏洞。

修复分支为 `fix/dependabot-security-alerts`。更新直接依赖和间接依赖后，
本地 `pnpm audit` 的所有严重程度均为 0。没有忽略或手动 dismiss 任何警报。
GitHub 上的警报状态需要修复进入默认分支后，由 Dependabot 重新扫描确认；
本地审计通过不等于远端警报已经关闭。

## 风险判断方法

本站以 `output: "static"` 构建，生产环境提供生成后的文件。
Dependabot 标记的 runtime dependency 可能实际上只参与构建，
不能直接等同于访客请求时执行的服务端代码。

评估同时考虑漏洞触发条件和实际调用路径：生产输出的注入风险、
构建及图片处理中的不可信输入、开发和检查工具中的输入处理风险。
没有发现这些警报所需的访客上传或动态 SSR 输入入口；
这降低当前可利用性，但不能替代依赖修复，也不是对整个站点的安全保证。

## High 警报

| 依赖与警报编号 | 原锁定版本 → 修复后版本 | 漏洞与本站影响 |
| --- | --- | --- |
| `nanoid` #104、#100、#98 | 3.3.11 → 3.3.18 | 整数溢出和异常长度导致无限循环。经 Vite → PostCSS 引入，用于构建；项目没有把访客提供的长度传给 Nano ID。 |
| `fast-uri` #103、#102、#101、#95、#90、#88 | 3.1.2 → 3.1.7 | URI 规范化的主机混淆及潜在 SSRF 绕过。经 AJV、Secretlint 和语言服务引入；本站未使用它实现访客可调用的 URL 代理或主机白名单。 |
| `js-yaml` #96、#92 | 4.1.1 / 4.2.0 → 4.3.2 / 5.2.2 | YAML 合并键、别名和 `!!omap` 可导致 CPU 消耗放大。影响 frontmatter、配置解析及检查工具；恶意仓库内容仍可能影响 CI。 |
| `postcss` #94、#93 | 8.5.10 → 8.5.28 | 恶意 CSS 的 `sourceMappingURL` 可触发任意 `.map` 文件读取。主要暴露面在构建期处理不可信 CSS，而非静态文件服务。 |
| `sharp` #91、#89 | 0.34.5 → 0.35.4 | libvips 处理不可信图像时存在漏洞。升级图像处理库及其预编译依赖；不能只更新 manifest 而保留 Astro 引入的旧副本。 |
| `linkify-it` #87 | 5.0.0 → 5.0.2 | `mailto:` 链接识别可触发平方级耗时，经 Markdown lint 引入；恶意 Markdown 可拖慢检查。 |
| `svgo` #86 | 4.0.1 → 4.1.0 | `removeScripts` 未完整移除可执行内容。项目未将该插件作为上传 SVG 的安全清洗器；仍升级 Astro 引入的副本。 |

Sharp 公告指出使用预编译二进制的用户应升级到包含修复版 libvips 的新版本；
本次采用 0.35.4，而非仅停在警报列出的最低 0.35.0。

## Medium 警报

| 依赖与警报编号 | 修复后版本 | 漏洞与本站影响 |
| --- | --- | --- |
| `postcss` #99 | 8.5.28 | 之前 Source Map 文件读取修复不完整，需至少 8.5.23；不能只按 High 警报的旧修复版本升级。 |
| `astro` #85、#83 | 7.3.1 | 原生 `HTMLElement` 子类组件的 spread 属性名可注入 HTML。利用还要求服务端全局 `HTMLElement` 和不可信属性键；本站未发现对应使用方式。 |
| `astro` #81、#78 | 7.3.1 | 不可信 View Transition 动画值可跳出内联样式并产生 XSS。本站没有动态 SSR 路由或从访客输入构造此类动画值。 |
| `@astrojs/rss` #80、#79 | 4.0.19 | `source.title` 和 `enclosure.type` 未转义造成 XML 注入。当前 RSS 未使用这两个字段；升级仍可避免未来使用时暴露。 |
| `js-yaml` #77 | 4.3.2 / 5.2.2 | 重复别名和合并键的复杂度 DoS，与 High YAML 修复一并处理。 |
| `markdown-it` #72 | 14.3.0 | smartquotes 规则具有平方级复杂度，经 Markdown lint 引入。升级上游 `markdownlint-cli2`，解除旧版精确依赖。 |

## Low 警报

| 依赖与警报编号 | 修复后版本 | 漏洞与本站影响 |
| --- | --- | --- |
| `astro` #84、#82 | 7.3.1 | hydrated islands 的不可信 `transition:*` 指令值可导致 XSS。本站未发现对应使用方式，随 Astro 升级修复。 |
| `esbuild` #70 | 0.28.2 | Windows 开发服务器任意文件读取。当前本地为 macOS，CI 为 Linux，也未将此服务器用于生产；仍更新依赖以覆盖 Windows 开发场景。 |

## 审计额外发现

完整审计还发现 `yaml@2.7.1` 的深层嵌套集合栈溢出问题，
不在此次 GitHub 的 29 个 open alerts 列表中。
来源为 `@astrojs/check` → Astro language server → Volar YAML → YAML language server。
升级检查器及兼容的语言服务依赖后，依赖树仅保留 `yaml@2.8.3` 和 `2.9.0`，
均满足该公告的修复版本要求。

## 已有 PR 的评估

| PR | 检查时状态 | 处理结论 |
| --- | --- | --- |
| [#145 RSS 安全升级](https://github.com/haeward/haeward.com/pull/145) | CI 成功 | 采用相同的 4.0.19 修复版本。 |
| [#146 Sharp 安全升级](https://github.com/haeward/haeward.com/pull/146) | CI 成功 | 纳入升级，并确认依赖树中没有旧 Sharp 副本。 |
| [#144 Astro 7 安全升级](https://github.com/haeward/haeward.com/pull/144) | CI 失败 | Astro 7 搭配 MDX 5，导入已不再导出的 `astro/jsx/rehype.js`，无法加载配置。 |
| [#147 Dependabot 分组升级](https://github.com/haeward/haeward.com/pull/147) | CI 失败 | 同样保留 MDX 5，存在相同兼容性阻塞。单独合并不能完成修复。 |
| [#131 MDX 8 升级](https://github.com/haeward/haeward.com/pull/131) | CI 失败 | 只更新 MDX，保留 Astro 6；MDX 8 要求 Astro ≥7.2.6，必须配套升级。 |
| [#148 Astro 同主版本更新](https://github.com/haeward/haeward.com/pull/148) | CI 成功 | 不能覆盖要求 Astro 7 修复版本的警报。 |
| [#149 Vite 7 补丁更新](https://github.com/haeward/haeward.com/pull/149) | CI 成功 | 本次因 Astro 7 改用 Vite 8，直接依赖同步到 8.2.2。 |

上述 PR 均仅作读取和评估，没有合并、关闭或修改。
本分支如被合并，应重新核对这些 PR 的差异，处理被覆盖的重复升级。

## 兼容性处理

- Astro 6.4.6 → 7.3.1，MDX 5.0.6 → 8.0.0，Vite 7.3.5 → 8.2.2。
- 显式安装 `@astrojs/markdown-remark@7.3.0`，使用 `unified()` 并保留
  `remarkSpotifyEmbed` 和 `remarkImageCaption`。这是保留现有内容处理所需的依赖。
- 设置 `compressHTML: true` 保持升级前的 HTML 空白处理模式。
- RSS 的 MDX renderer 改从 `@astrojs/mdx/container-renderer` 导入。
- `markdownlint-cli2` 0.22.1 精确锁定旧 `js-yaml` 和 `markdown-it`，
  因此升级到 0.23.2，而非添加强制覆盖规则。
- `@astrojs/check` 升级到 0.9.10，并更新兼容的间接语言服务依赖。
- 保留已有 pnpm 版本、override 和安装脚本策略；用 pnpm 生成 lockfile。

## 验证

使用 Node 24 和仓库声明的 pnpm 10.34.1：

- `pnpm audit`：0 个漏洞，包括开发依赖。
- 将 GitHub 的 29 个 open alerts 的漏洞版本范围逐一与 lockfile 中所有对应副本比对：
  0 个仍受影响的副本，0 个缺失匹配。
- `pnpm run check`、`pnpm run md:lint`、`pnpm run secrets:lint`：通过。
- `pnpm run smoke`：类型检查、静态构建、Pagefind 和桌面／移动端 Smoke 全部通过。
- 升级前后 12 个 HTML 页面的正文、标题锚点、图片说明和嵌入比对通过。
  比对排除了目录容器的空白序列化差异；标题锚点和目录功能仍经独立检查覆盖。
- 两篇 RSS 条目的元数据及全文 HTML 与升级前完全一致，XML 可正常解析。
- GitHub 的最终关闭状态及远端 CI/部署结果，应在推送和合并后另行确认。

## 参考

- [仓库 Dependabot alerts](https://github.com/haeward/haeward.com/security/dependabot)
- [Astro 7 迁移指南](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Astro 属性名注入公告](https://github.com/advisories/GHSA-f48w-9m4c-m7f5)
- [RSS XML 注入公告](https://github.com/advisories/GHSA-8j5q-mfj2-5q9q)
- [Sharp / libvips 公告](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)
- [SVGO removeScripts 公告](https://github.com/advisories/GHSA-2p49-hgcm-8545)
