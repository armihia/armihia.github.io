# Hanzhong Zhang 的个人主页

本站由 GitHub Pages 从 `main` 分支根目录发布。主页从 JSON 内容 API 读取研究近况、论文、项目、动态和照片。

## 用表单更新内容

1. 打开主页底部的 **Edit site**，或直接进入 [内容后台](https://armihia.github.io/admin/)。
2. 创建仅限 `armihia/armihia.github.io` 的细粒度 GitHub 令牌，仓库权限 **Contents** 设为 **Read and write**。把令牌填入后台的连接框。 [创建令牌](https://github.com/settings/personal-access-tokens/new)
3. 展开对应板块，编辑字段、增删条目或调整顺序。图片可填 HTTPS 网址，也可上传 JPG、PNG、WebP 或 AVIF。单次发布的 PDF 和图片合计最多 50 MiB。
4. 选择 **发布修改**。内容和新文件会一起提交到 `main`，GitHub Pages 通常在几分钟内更新。遇到并发修改时，可下载 JSON 草稿后刷新后台。

- **论文**支持编辑标题、作者、日期、发表状态和摘要，并上传 PDF 与首图。用 **首页展示位置** 选择「最新发表」「最新预印本」或「其他论文」。前两组各最多三篇，按后台的排列顺序展示。自动同步的新条目先进入 Other Publications。展开 **自动同步的论文** 可把条目加到编辑列表，补充信息后调整展示位置。
- **轮播动态**支持添加、编辑和删除动态，可以改标题、日期、来源、正文、链接和两张配图。用 **上移**、**下移** 调整轮播顺序。
- **个人介绍（About Me）**支持修改标题、正文和左侧图片。正文用空行分段。学校和导师在 **个人资料与首屏头像** 中维护。**学校和导师后的补充文字** 用常规字重接在同一段，可以用 `**粗体**`、`*斜体*` 和 `[链接文字](https://example.com)` 等行内 Markdown 排版。
- **个人资料与首屏头像**支持分别上传两张头像，并通过 **默认显示的头像** 指定访客进入首页时看到的那一张。上传的头像会等比居中取方形，转换为 **640 × 640** 的压缩图片。访客可点头像右下角的圆形按钮切换，悬停时会在图片显示后看到描述。
- **摄影**支持上传、替换和删除照片，也可更改图片描述、图注和顺序。用 **首页精选** 选择首页展示的照片，最多三张。 [摄影页](https://armihia.github.io/photography/)

由后台上传且内容里已无引用的文件会在发布时从当前分支删除，提交历史仍可追溯。

## 批量编辑界面文案

在后台展开 **界面文案 JSON**，点 **下载当前文案 JSON** 获取完整模板。修改引号内的值，再用 **上传文案 JSON** 载入草稿，确认后点 **发布修改**。也可以只上传要更新的字段。遇到字段名或格式错误时，后台会显示原因。

下面三项分别控制首页与摄影页的摄影标题、首页摄影入口的文字，以及首页底部引语。引语可用空字符串隐藏。模板里已有的 `{name}`、`{title}` 等占位符会在网页上显示相应的姓名或标题。

```json
{
  "photography": {
    "heading": "Photography",
    "viewAll": "View all photographs",
    "quote": "Although it may not be real life now, real life will come one day."
  }
}
```

## 内容 API

| 操作 | 路径 |
| --- | --- |
| 读取手动维护的内容 | [`GET /api/content.json`](https://armihia.github.io/api/content.json) |
| 读取自动同步的快照 | [`GET /api/imports.json`](https://armihia.github.io/api/imports.json) |
| 写入内容 | `PUT https://api.github.com/repos/armihia/armihia.github.io/contents/api/content.json` |

从脚本更新时，先通过带 `Authorization: Bearer <token>` 的 `GET` 请求读取上述 GitHub API 路径，查询参数为 `ref=main`。解码返回的 `content`，修改需要的字段，再用同一个凭据发送 `PUT`。请求体示例如下。 [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)

```json
{
  "message": "Update homepage content",
  "branch": "main",
  "sha": "<GET 返回的 sha>",
  "content": "<更新后的完整 UTF-8 JSON，Base64 编码>"
}
```

保留无关字段以及当前文件的 `sha`。如果 GitHub 返回冲突，重新读取并合并需要修改的字段。后台使用 GitHub 的 `createCommitOnBranch` 将上传的文件、删除操作和 JSON 写入同一个提交。 [GitHub GraphQL API](https://docs.github.com/en/graphql/reference/commits#createcommitonbranch)

论文的 `placement` 为 `published`、`preprint` 或 `other`，公开 PDF 地址写入 `pdf`。个人介绍可使用 `research.body` 和 `research.image`。既有的 `goal`、`approach` 和 `influences` 仍可作为介绍正文的来源。两张首页头像分别由 `profile.image` 和 `profile.secondaryImage` 设置，`profile.defaultPortrait` 可填写 `primary` 或 `secondary`。公开页面的文案覆写保存在 `ui`。个人介绍标题、相关论文标题及引语分别保存在 `research.heading`、`research.linksTitle` 和 `personal.quote`，与后台对应表单共用。

## 自动同步论文和视频

`Sync homepage content` 工作流每天北京时间约 11:23 同步，也可通过 GitHub 的 **Actions → Sync homepage content → Run workflow** 手动运行。合入 `main` 后，在仓库的 **Settings → Secrets and variables → Actions** 添加配置。

| 配置 | 用途 |
| --- | --- |
| Secret `SITE_SYNC_TOKEN` | 启用发布。使用对此仓库有 **Contents: Read and write** 权限的细粒度 GitHub 令牌，使同步提交触发分支式 GitHub Pages 重新发布。 |
| Secret `SERPAPI_KEY` | 启用 Google Scholar 同步，后台的 Scholar 资料 ID 已预填。未设置时会查询 ORCID 公开成果。 |
| Secret `ORCID_ACCESS_TOKEN` | 可选。ORCID 匿名访问受限时，可使用 `/read-public` 令牌。 |
| Variable `BILIBILI_RSS_BASE` | 可选。如果 B 站限制公开接口请求，可填可用的 HTTPS RSSHub 实例根地址，用其 `/bilibili/user/video/<UID>` 订阅源。 |

在后台的 **自动同步来源** 填写自己的 B 站空间网址（形如 `https://space.bilibili.com/123456`）或数字 UID，即可启用视频同步。主页优先使用手动维护的条目，同步条目按标题和链接去重。可在同一表单按链接或标题隐藏指定的同步结果。某个来源失败时，主页会继续使用该来源上一次成功的快照。

[SerpApi 学者资料接口](https://serpapi.com/google-scholar-author-api) · [ORCID 公开 API](https://info.orcid.org/what-is-orcid/services/public-api/) · [GitHub Pages 发布配置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 本地预览

```sh
python3 -m http.server 8000
```

浏览器访问 [本地主页](http://localhost:8000/)。用 `python3 scripts/sync_content.py` 可在本地刷新同步快照。
