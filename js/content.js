export function contentUrl(value) {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (/^(?:[a-z0-9][\w.-]*\/)*[a-z0-9][\w.-]*$/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}

export function emailUrl(value) {
  return typeof value === "string" && /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(value) ? `mailto:${value}` : "";
}

export function introductionBody(research) {
  if (typeof research.body === "string") return research.body;
  return [research.goal, research.approach, research.influences]
    .filter((paragraph) => typeof paragraph === "string" && paragraph.trim()).join("\n\n");
}

export async function readJson(url) {
  const response = await fetch(url, { cache: "no-cache", signal: AbortSignal.timeout?.(10000) });
  if (!response.ok) throw new Error(`Unable to load ${url} (${response.status})`);
  return response.json();
}

function urlKey(value) {
  const url = contentUrl(value);
  if (!url || !url.startsWith("https://")) return url;
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/$/, "");
  const arxiv = parsed.hostname === "arxiv.org"
    ? path.match(/^\/(?:abs|pdf)\/(\d{4}\.\d+)(?:v\d+)?(?:\.pdf)?$/i)
    : parsed.hostname === "doi.org" && path.match(/^\/10\.48550\/arxiv\.(\d{4}\.\d+)(?:v\d+)?$/i);
  if (arxiv) return `arxiv:${arxiv[1]}`;
  if (parsed.hostname === "doi.org") return `doi:${path.toLowerCase()}`;
  const video = /(^|\.)bilibili\.com$/.test(parsed.hostname) && path.match(/^\/video\/(BV[\da-z]+)$/i);
  if (video) return `bilibili:${video[1]}`;
  const citation = parsed.searchParams.get("citation_for_view");
  if (citation && parsed.hostname.startsWith("scholar.google.")) return `scholar:${citation}`;
  return `${parsed.hostname.replace(/^www\./, "")}${path}${parsed.search}`;
}

function titleKey(value) {
  return typeof value === "string" ? value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") : "";
}

export function itemsWithTitle(items) {
  return Array.isArray(items) ? items.filter((item) => typeof item?.title === "string" && item.title.trim()) : [];
}

export function importedItems(snapshot, sources) {
  const accountField = { scholar: "scholarId", orcid: "orcid", bilibili: "bilibiliUid" }[snapshot?.source];
  if (!accountField || !sources?.[accountField] || sources[accountField] !== snapshot.account) return [];
  return itemsWithTitle(snapshot.items);
}

export function newEntries(curated, imported, hidden = []) {
  const identities = (entry) => [
    titleKey(entry.title),
    urlKey(entry.url),
    ...(Array.isArray(entry.aliases) ? entry.aliases.map(titleKey) : []),
  ].filter(Boolean);
  const hiddenKeys = Array.isArray(hidden) ? hidden.flatMap((value) => [titleKey(value), urlKey(value)]) : [];
  const seen = new Set([...curated.flatMap(identities), ...hiddenKeys.filter(Boolean)]);

  return imported.filter((entry) => {
    const keys = identities(entry);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}
