# 图片存储与加载策略

当前实现使用仓库内资源与自有正文图片域名。优先减少下载体积、按显示尺寸选图、
稳定图片占位，再根据维护和发布成本决定是否迁移。发布步骤见
[正文图片预算](content-image-budget.md)，历史测量见[性能记录](performance/README.md)。

## 来源与维护边界

| 来源 | 当前用途 | 维护约定 |
| --- | --- | --- |
| 仓库内资源 | 站点图标、首页插画、豆瓣封面；支持少量新增正文图 | 随站点构建部署；保留原图，检查仓库、构建及部署体积 |
| 自有图片域名 | 当前正文的 `webp.haeward.com` 图片 | 保留原始链接与尺寸清单；上传、备份和底层托管独立维护 |
| 第三方直链 | Blogroll 新站点 favicon、少量可信外部素材 | 处理失效和限流；影响正文完整性的图片应有可恢复副本 |

正文图片的已测响应式变体记录在 `src/data/article-images.json`。
仓库没有 `webp.haeward.com` 的托管配置，不据此推断底层服务或费用。
当前没有本地正文照片副本；以后可用 `public/assets/images/posts/` 与现有同步命令。

本地资源通过站点部署提供给访客。来源形式本身不能判断快慢；应比较图片字节、
显示尺寸、加载时机、缓存及访客网络。平台行为以
[Pages 静态资源文档](https://developers.cloudflare.com/pages/configuration/serving-pages/)为准。

## 加载约定

- Blogroll 本地位图生成 32、64、96px WebP；SVG、ICO 保留原路径。
- 首页插画保持 144px 方形布局，提供按屏幕密度选择的 WebP 候选。
- 媒体封面生成质量 75、最大 540px 的 WebP，不放大；SSR 与分页共用 URL。
- 正文测量真实变体宽高，以 `srcset`、`sizes` 选图，并为最终拟合空间预留比例。
- 正文首图 eager/high，其余 lazy；仅使用现有图片域名的文章建立预连接。
- 放大视图先显示已加载预览，再解码合适尺寸的清晰版本；原图由读者明确打开。
  图片链接退出悬停／聚焦预取，失败时保留预览并提供重试。

本地变体在构建或同步时生成，不覆盖原始素材。位图压缩后检查文字、细线、透明
边缘和构图；完整解码不能证明没有已经编码进图片的损坏像素。

## 缓存与更新

Astro 内容指纹 URL 使用 `public/_headers` 中的长期缓存规则，内容变化时 URL 改变。
可能被覆盖的固定文件名不能直接继承整个 `/_astro/` 的 immutable 策略。
正文清单和本地正文变体也不是自动生成的内容指纹 URL；替换图片前应考虑其实际
托管缓存，必要时使用新文件名或版本地址，并重新测量尺寸。

不要给整个固定图片目录随意添加一年 immutable。平台头规则及其覆盖关系以
[Pages 自定义响应头](https://developers.cloudflare.com/pages/configuration/headers/)为准，
修改后检查本地和线上响应。

## 迁移条件

当图片明显拖慢 Git 克隆、构建或部署，需要频繁独立批量上传，或原图与变体开始
接近部署文件数量／单文件限制时，再评估对象存储。统计完整 `dist/`，包括保留原图、
变体、页面和搜索索引；历史文件数量不能当作当前库存。
发布前重新核对[Pages 平台限制](https://developers.cloudflare.com/pages/platform/limits/)。

迁移时保留原图备份、稳定路径、尺寸清单和响应式展示。自有域名便于以后更换存储。
若选 R2，分别核对[公共访问方式](https://developers.cloudflare.com/r2/buckets/public-buckets/)、
[存储与请求费用](https://developers.cloudflare.com/r2/pricing/)及
[图片处理费用](https://developers.cloudflare.com/images/pricing/)；固定变体可以预生成。
存储迁移与动态转换是独立选择，无需为了假设的增长立即增加服务。
