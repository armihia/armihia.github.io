import { contentUrl, emailUrl, importedItems, introductionBody, itemsWithTitle, newEntries } from "./content.js";
import { featuredPhotos, photosWithImages } from "./photos.js";
import { groupPublications, publicationsPerGroup } from "./publications.js";

const repo = "armihia/armihia.github.io";
const branch = "main";
const path = "api/content.json";
const api = "https://api.github.com";
const repoApi = `/repos/${repo}`;
const $ = (id) => document.getElementById(id);
const form = $("content-form");
const fields = $("editor-fields");
const pendingFiles = new Map();
const imageExtensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const uploadLimitMiB = 50;
const uploadLimit = uploadLimitMiB * 1024 * 1024;
const fileId = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const uploadedAssetPath = new RegExp(`^(?:images/uploads/${fileId}\\.(?:jpg|png|webp|avif)|papers/uploads/${fileId}\\.pdf)$`);
const siteOrigin = "https://armihia.github.io/";
const publicationStatuses = [
  ["", "自动判断"], ["preprint", "预印本"], ["published", "已发表"], ["other", "其他"],
];
const publicationPlacements = [
  ["published", "最新发表"], ["preprint", "最新预印本"], ["other", "其他论文"],
];
const placementNames = Object.fromEntries(publicationPlacements);

let credential;
let base;
let draft;
let dirty = false;

const sections = [
  {
    label: "个人资料与首屏头像", key: "profile", open: true,
    fields: [
      ["name", "姓名", "text", true], ["field", "研究领域"], ["role", "身份"],
      ["institution", "学校或机构"], ["institutionUrl", "机构网址", "url"],
      ["supervisor", "导师"], ["supervisorUrl", "导师网址", "url"],
      ["location", "所在地"], ["email", "邮箱", "email"],
      ["image", "首屏头像", "image"], ["imageAlt", "头像描述"],
    ],
  },
  {
    label: "个人介绍（About Me）", key: "research",
    hint: "正文用空行分段。学校和导师来自个人资料，也可以关闭自动显示后把它们写进正文。",
    fields: [["heading", "介绍标题", "text", false, "About Me"],
      ["showAffiliation", "显示学校和导师", "checkbox", false, true],
      ["body", "介绍正文", "long", false, introductionBody],
      ["image", "介绍区图片", "image"], ["imageAlt", "介绍区图片描述"],
      ["linksTitle", "相关论文链接标题", "text", false, "Related work"]],
  },
  { label: "相关论文链接", key: "research.papers", item: "链接", fields: [["label", "名称", "text", true], ["url", "网址", "url", true], ["note", "说明"]] },
  {
    label: "论文", key: "publications", item: "论文", removeLabel: "删除论文",
    hint: "用「首页展示位置」指定分区。最新发表和最新预印本各最多三篇，按此处顺序展示。",
    defaults: { placement: "other" },
    note: (entry) => placementNames[entry.placement],
    fields: [["title", "论文标题", "text", true], ["authors", "作者"], ["year", "年份", "year"],
      ["status", "发表状态", "publication-status"], ["date", "日期（YYYY-MM 或 YYYY-MM-DD）", "publication-date"],
      ["placement", "首页展示位置", "publication-placement"], ["venue", "期刊或会议"], ["url", "论文链接", "url"],
      ["pdf", "论文 PDF", "pdf"], ["summary", "摘要或内容说明", "long"],
      ["image", "首图", "image"], ["figureAlt", "首图描述"]],
  },
  {
    label: "项目与视频", key: "projects", item: "项目",
    fields: [["title", "项目或视频标题", "text", true], ["category", "类别"], ["url", "项目或视频链接", "url"],
      ["summary", "简介", "long"], ["image", "封面", "image"]],
  },
  {
    label: "摄影", key: "photos", item: "照片", removeLabel: "删除照片",
    hint: "摄影页显示所有照片。勾选首页精选后，首页按此处顺序显示最多三张。",
    defaults: { featured: false },
    note: (entry) => entry.featured ? "首页精选" : "",
    fields: [["image", "图片", "image", true], ["alt", "图片描述", "text", true],
      ["caption", "图注"], ["featured", "首页精选", "checkbox"]],
  },
  {
    label: "轮播动态", key: "news", item: "动态", removeLabel: "删除动态",
    fields: [["title", "标题", "text", true], ["date", "日期（如 2026-11-21）"], ["outlet", "来源"],
      ["url", "链接", "url"], ["summary", "动态正文", "long"], ["image", "第一张配图", "image"],
      ["imageAlt", "第一张配图描述"], ["secondaryImage", "第二张配图", "image"], ["secondaryImageAlt", "第二张配图描述"]],
  },
  { label: "个人兴趣", key: "personal", fields: [["interests", "兴趣"], ["skills", "编程语言"], ["quote", "引用", "long"]] },
  {
    label: "荣誉与经历", key: "experience", item: "经历",
    fields: [["title", "名称", "text", true], ["detail", "说明"], ["year", "年份", "year"]],
  },
  { label: "其他个人链接", key: "links", item: "链接", fields: [["label", "名称", "text", true], ["url", "网址", "url", true]] },
  {
    label: "自动同步来源", key: "sources",
    hint: "Google Scholar 同步使用 SerpApi，也可使用 ORCID。填写 B 站空间链接或 UID 可启用该账号的同步。定时任务和仓库密钥的配置见 README。",
    fields: [
      ["scholarId", "Google Scholar 个人资料 ID", "scholar"], ["orcid", "ORCID", "orcid"],
      ["bilibiliUid", "B 站空间链接或 UID", "bilibili"],
      ["hiddenPublications", "隐藏的同步论文（每行一个标题或链接）", "lines"],
      ["hiddenVideos", "隐藏的同步视频（每行一个标题或链接）", "lines"],
    ],
  },
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function status(node, message, error = false) {
  node.textContent = message;
  node.toggleAttribute("data-error", error);
}

function setDirty() {
  dirty = true;
  $("save").disabled = false;
  status($("save-status"), "有未发布的修改。");
  updatePublicationCounts();
}

function updatePublicationCounts() {
  const counts = { published: 0, preprint: 0 };
  for (const paper of draft.publications || []) {
    if (paper?.placement === "published" || paper?.placement === "preprint") counts[paper.placement]++;
  }
  const limit = publicationsPerGroup;
  const overflow = counts.published > limit || counts.preprint > limit;
  const row = $("publication-counts");
  if (row) {
    const message = `最新发表 ${counts.published}/${limit} · 最新预印本 ${counts.preprint}/${limit}`
      + (overflow ? "。请将多出的论文移到其他论文。" : "");
    if (row.textContent !== message) status(row, message, overflow);
  }
  return overflow;
}

function bilibiliId(value) {
  return /^\d+$/.test(value) ? value : (value.match(/^https:\/\/space\.bilibili\.com\/(\d+)(?:[/?#]|$)/)?.[1] || "");
}

function validate(value, type) {
  if (!value) return "";
  if (["image", "pdf", "url"].includes(type) && !contentUrl(value)) return "请填写 HTTPS 网址或站内文件路径。";
  if (type === "email" && !emailUrl(value)) return "请填写有效的邮箱地址。";
  if (type === "scholar" && !/^[\w-]+$/.test(value)) return "请填写 Google Scholar 网址中 user= 后的 ID。";
  if (type === "orcid" && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value)) return "请填写格式如 0000-0001-9495-4996 的 ORCID。";
  if (type === "bilibili" && !bilibiliId(value)) return "请填写数字 UID 或有效的 B 站空间网址。";
  if (type === "publication-date" && !/^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/.test(value)) {
    return "请填写 YYYY-MM 或 YYYY-MM-DD 格式的日期。";
  }
  return "";
}

function fileControl(wrapper, input, update, type) {
  const pdf = type === "pdf";
  const preview = pdf ? element("a", "editor-file-preview", "打开 PDF") : element("img", "editor-photo");
  const source = pdf ? "href" : "src";
  if (pdf) {
    preview.target = "_blank";
    preview.rel = "noopener noreferrer";
  } else {
    preview.alt = "图片预览";
    preview.loading = "lazy";
  }
  const uploadLabel = element("label", "upload-label", pdf ? "上传 PDF" : "或上传 JPG、PNG、WebP、AVIF");
  const upload = element("input");
  upload.type = "file";
  upload.accept = pdf ? ".pdf,application/pdf" : Object.keys(imageExtensions).join(",");
  uploadLabel.append(upload);
  wrapper.append(uploadLabel, preview);

  function showPreview() {
    const url = contentUrl(input.value);
    const pending = pendingFiles.get(url);
    if (!url) {
      preview.hidden = true;
      preview.removeAttribute(source);
      return;
    }
    preview.hidden = false;
    preview[source] = pending?.preview || (url.startsWith("https://") ? url : `../${url}`);
  }

  input.addEventListener("change", showPreview);
  upload.addEventListener("change", () => {
    const file = upload.files[0];
    upload.value = "";
    if (!file) return;
    const extension = pdf ? (/\.pdf$/i.test(file.name) || file.type === "application/pdf" ? "pdf" : "") : imageExtensions[file.type];
    if (!extension || !file.size || file.size > uploadLimit) {
      const formats = pdf ? "PDF" : "JPG、PNG、WebP 或 AVIF";
      status($("save-status"), `请选择有效且不超过 ${uploadLimitMiB} MiB 的 ${formats} 文件。`, true);
      return;
    }
    const directory = pdf ? "papers/uploads" : "images/uploads";
    const filePath = `${directory}/${crypto.randomUUID()}.${extension}`;
    pendingFiles.set(filePath, { file, preview: URL.createObjectURL(file) });
    input.value = filePath;
    update();
    showPreview();
  });
  showPreview();
}

function control(record, [key, title, type = "text", required = false, fallback], onInput) {
  const wrapper = element("div", "editor-control");
  const label = element("label", "", title);
  const multiline = type === "long" || type === "lines";
  const checkbox = type === "checkbox";
  const options = { "publication-status": publicationStatuses, "publication-placement": publicationPlacements }[type];
  const input = element(options ? "select" : multiline ? "textarea" : "input");
  if (options) {
    input.setAttribute("aria-label", title);
    input.append(...options.map(([value, name]) => new Option(name, value)));
  }
  if (multiline) wrapper.classList.add("editor-control-wide");
  if (input instanceof HTMLInputElement) input.type = { year: "number", email: "email", checkbox: "checkbox" }[type] || "text";
  if (type === "year") {
    input.min = "1";
    input.max = "9999";
  }
  input.required = required;
  const initial = record[key] ?? (typeof fallback === "function" ? fallback(record) : fallback);
  if (checkbox) {
    input.checked = initial === true;
    label.className = "editor-checkbox";
    label.prepend(input);
  } else {
    input.value = type === "lines" ? (initial || []).join("\n") : initial ?? "";
    label.append(input);
  }
  wrapper.append(label);
  input.setCustomValidity(validate(input.value.trim(), type));

  function update() {
    const value = input.value.trim();
    if (checkbox) {
      record[key] = input.checked;
    } else if (type === "lines") {
      record[key] = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    } else if (type === "year") {
      if (value) record[key] = Number(value);
      else delete record[key];
    } else {
      record[key] = type === "bilibili" ? bilibiliId(value) || value : value;
    }
    input.setCustomValidity(validate(value, type) || (required && !value ? "请填写此项。" : ""));
    onInput?.();
    setDirty();
  }
  input.addEventListener("input", update);
  if (type === "image" || type === "pdf") fileControl(wrapper, input, update, type);
  return wrapper;
}

function group(record, definitions, onInput) {
  const node = element("div", "editor-fields-group");
  node.append(...definitions.map((definition) => control(record, definition, onInput)));
  return node;
}

function action(label, handler) {
  const button = element("button", "", label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function collection(section, entries, { item, fields: definitions, removeLabel = "移除", defaults, note }) {
  const list = element("div", "editor-list");
  const add = action(`添加${item}`, () => appendEntry());
  section.append(list, add);

  function appendEntry(values) {
    const entry = { ...defaults, ...values };
    entries.push(entry);
    renderList(entry);
    list.lastElementChild.querySelector("input").focus();
    setDirty();
  }

  function renderList(focused) {
    const open = new Set([...list.children].filter((node) => node.open).map((node) => node.record));
    list.replaceChildren(...entries.map((entry, index) => {
      const card = element("details", "editor-entry");
      card.record = entry;
      card.open = entry === focused || open.has(entry);
      const summary = element("summary");
      const name = () => {
        summary.textContent = entry.title || entry.label || entry.caption || entry.alt || `新${item}`;
        const placement = note?.(entry);
        if (placement) summary.append(" ", element("span", "editor-entry-note", placement));
      };
      name();
      const buttons = element("div", "editor-entry-actions");
      function move(offset) {
        [entries[index + offset], entries[index]] = [entries[index], entries[index + offset]];
        renderList(entry);
        list.children[index + offset].querySelector("summary").focus();
        setDirty();
      }
      const up = action("上移", () => move(-1));
      const down = action("下移", () => move(1));
      up.disabled = index === 0;
      down.disabled = index === entries.length - 1;
      buttons.append(up, down, action(removeLabel, () => {
        entries.splice(index, 1);
        renderList();
        (list.children[index]?.querySelector("summary") || add).focus();
        setDirty();
      }));
      card.append(summary, group(entry, definitions, name), buttons);
      return card;
    }));
  }
  renderList();
  return appendEntry;
}

function syncedPublications(appendEntry) {
  const section = element("details", "editor-synced");
  const list = element("ul", "editor-synced-list");
  const note = element("p", "editor-status");
  note.setAttribute("role", "status");
  const load = action("读取同步论文", async () => {
    load.disabled = true;
    status(note, "正在读取同步论文…");
    list.replaceChildren();
    try {
      const snapshot = JSON.parse(await contentAt(branch, credential, "api/imports.json"));
      showPapers(snapshot.publications);
    } catch (error) {
      status(note, `读取同步论文失败。 ${error.message}`, true);
    } finally {
      load.disabled = false;
    }
  });
  section.append(element("summary", "", "自动同步的论文"), load, note, list);

  function showPapers(snapshot) {
    const papers = availablePapers(snapshot);
    status(note, papers.length ? "添加到编辑列表后，可以补充 PDF、首图并设置展示位置。" : "暂无可添加的同步论文。");
    list.replaceChildren(...papers.map((paper) => {
      const item = element("li");
      const title = [paper.title, paper.year].filter(Boolean).join(" · ");
      const add = action("添加到编辑列表", () => {
        if (availablePapers(snapshot).includes(paper)) appendEntry({ ...paper, placement: "other" });
        else load.focus();
        showPapers(snapshot);
      });
      add.setAttribute("aria-label", `添加到编辑列表 · ${paper.title}`);
      item.append(element("span", "", title), add);
      return item;
    }));
  }

  function availablePapers(snapshot) {
    return newEntries(itemsWithTitle(draft.publications), importedItems(snapshot, draft.sources));
  }
  return section;
}

function showEditor() {
  fields.replaceChildren(...sections.map((definition) => {
    const { label, key, open, hint, item, fields: definitions } = definition;
    const [outer, inner] = key.split(".");
    const parent = inner ? (draft[outer] ??= {}) : draft;
    const recordKey = inner || outer;
    const value = parent[recordKey] ??= (item ? [] : {});
    const section = element("details", "editor-section");
    section.open = Boolean(open);
    section.append(element("summary", "", label));
    if (hint) section.append(element("p", "editor-hint", hint));
    if (key === "publications") {
      section.id = "editor-publications";
      const counts = element("p", "editor-hint editor-status");
      counts.id = "publication-counts";
      section.append(counts);
    }
    if (item) {
      const appendEntry = collection(section, value, definition);
      if (key === "publications") section.append(syncedPublications(appendEntry));
    } else section.append(group(value, definitions));
    return section;
  }));
  updatePublicationCounts();
}

async function request(endpoint, token, body) {
  const response = await fetch(api + endpoint, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout?.(body ? 180000 : 45000),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    throw new Error(result.errors?.[0]?.message || result.message || `GitHub HTTP ${response.status}`);
  }
  return result;
}

async function head(token) {
  const { object } = await request(`${repoApi}/git/ref/heads/${branch}`, token);
  return object.sha;
}

async function contentAt(commit, token, file = path) {
  const { content } = await request(`${repoApi}/contents/${file}?ref=${commit}`, token);
  return new TextDecoder().decode(Uint8Array.from(atob(content), (character) => character.charCodeAt(0)));
}

function base64File(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function referencedUploads(json) {
  const uploads = new Set();
  JSON.parse(json, (_key, value) => {
    if (typeof value === "string") {
      const url = contentUrl(value);
      const path = url.startsWith(siteOrigin) ? new URL(url).pathname.slice(1) : url;
      if (uploadedAssetPath.test(path)) uploads.add(path);
    }
    return value;
  });
  return uploads;
}

async function deletedUploads(references, commit) {
  const removed = new Set([...referencedUploads(base.json)].filter((path) => !references.has(path)));
  if (!removed.size) return [];

  const { tree } = await request(`${repoApi}/git/commits/${commit}`, credential);
  const { tree: files } = await request(`${repoApi}/git/trees/${tree.sha}?recursive=1`, credential);
  return files.filter((file) => file.type === "blob" && removed.has(file.path))
    .map((file) => ({ path: file.path }));
}

async function publish(json) {
  const latest = await head(credential);
  if (latest !== base.head) {
    const latestJson = await contentAt(latest, credential);
    if (latestJson === json) {
      base = { head: latest, json };
      pendingFiles.clear();
      return;
    }
    if (latestJson !== base.json) {
      throw new Error("GitHub 上的主页内容已被其他会话修改。请下载当前草稿，刷新后再合并修改。");
    }
  }
  const references = referencedUploads(json);
  const files = [...pendingFiles.entries()].filter(([filePath]) => references.has(filePath));
  if (files.reduce((total, [, { file }]) => total + file.size, 0) > uploadLimit) {
    throw new Error(`本次上传的文件总大小超过 ${uploadLimitMiB} MiB。请压缩文件或分批发布。`);
  }
  const additions = await Promise.all(files.map(async ([filePath, { file }]) => ({
    path: filePath, contents: await base64File(file),
  })));
  const bytes = new TextEncoder().encode(json);
  additions.unshift({ path, contents: btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")) });
  const deletions = await deletedUploads(references, latest);

  const { data } = await request("/graphql", credential, {
    query: `mutation Publish($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) { commit { oid } }
    }`,
    variables: {
      input: {
        branch: { repositoryNameWithOwner: repo, branchName: branch },
        expectedHeadOid: latest,
        message: { headline: "Update homepage content" },
        fileChanges: { additions, ...(deletions.length && { deletions }) },
      },
    },
  });
  base = { head: data.createCommitOnBranch.commit.oid, json };
  pendingFiles.clear();
}

function serialize() {
  return JSON.stringify(draft, null, 2) + "\n";
}

$("connect-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("token");
  const token = input.value.trim();
  if (!token) return;
  $("connect").disabled = true;
  status($("connection-status"), "正在连接 GitHub…");
  try {
    const commit = await head(token);
    const json = await contentAt(commit, token);
    draft = JSON.parse(json);
    const groups = groupPublications(itemsWithTitle(draft.publications));
    for (const [placement, papers] of Object.entries(groups)) {
      for (const paper of papers) {
        if (!Object.hasOwn(placementNames, paper.placement)) paper.placement = placement;
      }
    }
    const photos = photosWithImages(draft.photos);
    const selected = new Set(featuredPhotos(photos));
    for (const photo of photos) {
      if (typeof photo.featured !== "boolean") photo.featured = selected.has(photo);
    }
    showEditor();
    base = { head: commit, json };
    credential = token;
    input.value = "";
    $("connect-form").hidden = true;
    form.hidden = false;
    fields.querySelector("summary").focus();
  } catch (error) {
    status($("connection-status"), `连接失败。 ${error.message}`, true);
  } finally {
    $("connect").disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dirty || $("save").disabled) return;
  if (updatePublicationCounts()) {
    const section = $("editor-publications");
    section.open = true;
    section.querySelector("summary").focus();
    status($("save-status"), "最新发表和最新预印本各最多三篇。请先调整论文的展示位置。", true);
    return;
  }
  const invalid = Array.from(fields.querySelectorAll("input, textarea, select")).find((input) => !input.validity.valid);
  if (invalid) {
    for (let parent = invalid.parentElement; parent && parent !== fields; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    invalid.reportValidity();
    return;
  }
  const json = serialize();
  if (json === base.json) {
    dirty = false;
    $("save").disabled = true;
    status($("save-status"), "内容已是最新。");
    return;
  }
  fields.disabled = true;
  $("save").disabled = true;
  status($("save-status"), "正在提交内容和文件…");
  try {
    await publish(json);
    dirty = false;
    status($("save-status"), "修改已提交。GitHub Pages 通常在几分钟内更新。");
  } catch (error) {
    status($("save-status"), `发布失败。 ${error.message}`, true);
  } finally {
    fields.disabled = false;
    $("save").disabled = !dirty;
  }
});

$("download").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([serialize()], { type: "application/json" }));
  const link = element("a");
  link.href = url;
  link.download = "homepage-content.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

window.addEventListener("beforeunload", (event) => {
  if (dirty) event.preventDefault();
});
