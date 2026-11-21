export const publicationsPerGroup = 3;

function publicationStatus(paper) {
  if (["preprint", "published", "other"].includes(paper.status)) return paper.status;
  const venue = paper.venue || "";
  if (/\b(?:accepted|under review|in press|forthcoming)\b/i.test(venue)) return "other";
  if (/\b(?:arxiv|biorxiv|medrxiv|preprint)\b|doi\.org\/10\.(?:1101|2139|21203)\//i.test(`${venue} ${paper.url || ""}`)) {
    return "preprint";
  }
  return venue && /^https:\/\/doi\.org\/10\./i.test(paper.url) ? "published" : "other";
}

export function publicationDate(paper) {
  if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(paper.date || "")) return paper.date;
  return /^\d{4}$/.test(paper.year || "") ? String(paper.year) : "";
}

export function groupPublications(curated, imported = []) {
  const sorted = [...curated, ...imported].sort((a, b) => publicationDate(b).localeCompare(publicationDate(a)));
  const manual = curated.some((paper) => ["preprint", "published", "other"].includes(paper.placement));
  const candidates = manual ? curated : sorted;
  const placement = (paper) => manual ? paper.placement : publicationStatus(paper);
  const picks = (group) => candidates.filter((paper) => placement(paper) === group).slice(0, publicationsPerGroup);
  const preprint = picks("preprint");
  const published = picks("published");
  const selected = new Set([...preprint, ...published]);
  return { preprint, published, other: sorted.filter((paper) => !selected.has(paper)) };
}
