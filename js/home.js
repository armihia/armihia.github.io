import { contentUrl, emailUrl, importedItems, introductionBody, itemsWithTitle, newEntries, readJson } from "./content.js";
import { featuredPhotos, photosWithImages, photoTile } from "./photos.js";
import { groupPublications, publicationDate } from "./publications.js";

const byId = (id) => document.getElementById(id);

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function link(label, href) {
  const el = element("a", "", label);
  el.href = href;
  return el;
}

function textAt(id, value) {
  const node = byId(id);
  node.textContent = value || "";
  node.hidden = !value;
}

function image(src, alt = "") {
  const url = contentUrl(src);
  if (!url) return null;
  const img = element("img");
  img.src = url;
  img.alt = alt;
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  return img;
}

function heading(title, href, level = "h3") {
  const h = element(level);
  h.append(href ? link(title, href) : title);
  return h;
}

function listItem(...children) {
  const li = element("li");
  li.append(...children.filter(Boolean));
  return li;
}

function setList(id, entries, render) {
  byId(id).replaceChildren(...entries.map(render).filter(Boolean));
}

function showSection(id, visible) {
  byId(id).hidden = !visible;
  document.querySelectorAll(`nav a[href="#${id}"]`).forEach((navLink) => {
    navLink.hidden = !visible;
  });
}

function setupMenu() {
  const menu = byId("site-menu");
  if (typeof menu.showModal !== "function") return;
  const toggle = byId("menu-toggle");
  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    menu.showModal();
    toggle.setAttribute("aria-expanded", "true");
  });
  byId("menu-close").addEventListener("click", () => menu.close());
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a") || (event.target === menu && event.clientX > menu.getBoundingClientRect().right)) {
      menu.close();
    }
  });
  menu.addEventListener("close", () => toggle.setAttribute("aria-expanded", "false"));
}

function renderProfile(profile, links) {
  if (!profile?.name) return;
  document.title = `${profile.name} - Personal website`;
  document.querySelectorAll("[data-profile-name]").forEach((el) => { el.textContent = profile.name; });
  textAt("field", profile.field);

  const affiliation = byId("affiliation");
  affiliation.replaceChildren();
  const institution = contentUrl(profile.institutionUrl);
  const mentor = contentUrl(profile.supervisorUrl);
  if (profile.role) affiliation.append(profile.institution ? `${profile.role} at the ` : profile.role);
  if (profile.institution) affiliation.append(institution ? link(profile.institution, institution) : profile.institution);
  if (profile.supervisor) {
    affiliation.append(affiliation.textContent ? ", supervised by " : "Supervised by ");
    affiliation.append(mentor ? link(profile.supervisor, mentor) : profile.supervisor);
  }
  if (affiliation.textContent) affiliation.append(".");
  affiliation.hidden = !affiliation.textContent;

  const portrait = byId("portrait");
  const photo = portrait.querySelector("img");
  const portraitUrl = contentUrl(profile.image);
  portrait.hidden = !portraitUrl;
  if (portraitUrl) {
    photo.src = portraitUrl;
    photo.alt = profile.imageAlt || profile.name;
  }

  const email = emailUrl(profile.email);
  setList("profile-links", links, ({ label, url }) => listItem(link(label, url)));
  const contact = byId("contact-email");
  contact.hidden = !email;
  if (email) {
    contact.href = email;
    contact.textContent = profile.email;
  }
  textAt("location", profile.location);
}

function renderResearch(research, profile) {
  textAt("research-title", research.heading?.trim?.() || "About Me");
  const affiliation = byId("affiliation");
  affiliation.hidden = research.showAffiliation === false || !affiliation.textContent.trim();
  const paragraphs = introductionBody(research).split(/\r?\n[\t ]*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const body = byId("research-body");
  body.replaceChildren(...paragraphs.map((paragraph) => element("p", "", paragraph)));
  body.hidden = !paragraphs.length;

  const photo = image(research.image, research.imageAlt || profile?.name || "Portrait");
  const photoFrame = byId("about-photo");
  photoFrame.replaceChildren(...(photo ? [photo] : []));
  photoFrame.hidden = !photo;
  byId("about-layout").classList.toggle("with-photo", Boolean(photo));

  const papers = Array.isArray(research.papers) ? research.papers.filter((paper) => paper?.label && contentUrl(paper.url)) : [];
  textAt("research-links-title", research.linksTitle?.trim?.() || "Related work");
  setList("research-papers", papers, (paper) => listItem(
    link(paper.label, contentUrl(paper.url)),
    paper.note && element("span", "", ` · ${paper.note}`),
  ));
  document.querySelector(".research-reading").hidden = !papers.length;
  showSection("aboutme", Boolean(photo || !affiliation.hidden || paragraphs.length || papers.length));
}

function publication(paper, featured = false) {
  const date = publicationDate(paper);
  const year = date.slice(0, 4);
  const copy = element("div");
  const pdf = contentUrl(paper.pdf);
  copy.append(heading(paper.title, contentUrl(paper.url) || pdf, featured ? "h4" : "h3"));
  if (paper.authors) copy.append(element("p", "publication-authors", paper.authors));
  const meta = [featured && year, paper.venue].filter(Boolean).join(" · ");
  if (meta) copy.append(element("p", "publication-meta", meta));
  const links = element("p", "publication-links");
  if (pdf) {
    const attachment = link("PDF", pdf);
    attachment.setAttribute("aria-label", `PDF · ${paper.title}`);
    links.append(attachment);
  }
  const figureUrl = contentUrl(paper.image);
  if (!featured && figureUrl) links.append(link("Figure", figureUrl));
  if (links.children.length) copy.append(links);
  if (paper.summary) {
    const details = element("details", "paper-summary");
    details.append(element("summary", "", "Summary"), element("p", "", paper.summary));
    copy.append(details);
  }
  if (featured) {
    const figure = image(paper.image, paper.figureAlt || `Figure from ${paper.title}`);
    const cover = figure ? link("", figureUrl) : null;
    if (cover) {
      cover.className = "paper-figure";
      cover.append(figure);
      figure.addEventListener("error", () => {
        cover.classList.add("paper-figure-unavailable");
        cover.textContent = "Open figure";
      });
    }
    const item = listItem(cover, copy);
    item.className = "paper-feature";
    return item;
  }

  const entry = listItem(element("span", "publication-year", year), copy);
  entry.className = "publication";
  return entry;
}

function renderPublications(curated, imported, scholar) {
  const groups = groupPublications(curated, imported);
  for (const status of ["preprint", "published"]) {
    const recent = groups[status];
    byId(`${status}-group`).hidden = !recent.length;
    setList(`${status}-list`, recent, (paper) => publication(paper, true));
  }

  byId("more-publications").hidden = !groups.other.length;
  setList("earlier-publications", groups.other, (paper) => publication(paper));
  byId("scholar-link").hidden = !scholar;
  if (scholar) byId("scholar-link").href = scholar;
  showSection("publication", curated.length + imported.length > 0);
}

function news(item) {
  const title = heading(item.title, contentUrl(item.url));
  const meta = [item.date, item.outlet].filter(Boolean).join(" · ");
  const photos = [image(item.image, item.imageAlt), image(item.secondaryImage, item.secondaryImageAlt)].filter(Boolean);
  const gallery = photos.length ? element("div", "news-images") : null;
  gallery?.append(...photos);
  const summary = item.summary && element("p", "news-summary", item.summary);
  const slide = listItem(title, meta && element("p", "news-meta", meta), summary, gallery);
  slide.className = "news-slide";
  return slide;
}

function renderNews(articles) {
  showSection("interview", articles.length > 0);
  const track = byId("news-list");
  const controls = byId("news-navigation");
  const slides = articles.map(news);
  track.replaceChildren(...slides);
  controls.hidden = slides.length <= 1;
  track.tabIndex = slides.length > 1 ? 0 : -1;
  if (slides.length <= 1) return;

  let current = -1;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function goTo(index) {
    const position = Math.max(0, Math.min(index, slides.length - 1));
    track.scrollTo({ left: position * track.clientWidth, behavior: reducedMotion.matches ? "auto" : "smooth" });
  }

  const dots = articles.map((item, index) => {
    const dot = element("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Show ${item.title}`);
    dot.setAttribute("aria-controls", "news-list");
    dot.addEventListener("click", () => goTo(index));
    return dot;
  });
  controls.replaceChildren(...dots);

  function updateCurrent() {
    if (!track.clientWidth) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index === current) return;
    current = index;
    slides.forEach((slide, position) => {
      slide.inert = position !== current;
      dots[position].setAttribute("aria-pressed", String(position === current));
    });
  }
  updateCurrent();
  track.addEventListener("scroll", updateCurrent, { passive: true });
  track.addEventListener("keydown", (event) => {
    if (event.target !== track || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    goTo(current + (event.key === "ArrowLeft" ? -1 : 1));
  });
}

function project(item) {
  const copy = element("div", "project-copy");
  const meta = [item.category, item.date].filter(Boolean).join(" · ");
  if (meta) copy.append(element("p", "project-category", meta));
  const href = contentUrl(item.url);
  copy.append(heading(item.title, href));
  if (item.summary) copy.append(element("p", "project-description", item.summary));
  const img = image(item.image);
  const li = listItem(img, copy);
  li.dataset.category = item.category || "";
  if (img && href) {
    const cover = link("", href);
    cover.tabIndex = -1;
    cover.setAttribute("aria-hidden", "true");
    img.replaceWith(cover);
    cover.append(img);
  }
  return li;
}

function renderProjects(projects, videos, bilibili) {
  showSection("mywork", projects.length + videos.length > 0);
  byId("bilibili-link").hidden = !bilibili;
  if (bilibili) byId("bilibili-link").href = bilibili;
  const featured = [...videos.slice(0, 3), ...projects].map(project);
  const archive = videos.slice(3).map(project);
  byId("project-list").replaceChildren(...featured);
  byId("video-list").replaceChildren(...archive);
  const more = byId("more-videos");
  more.hidden = !archive.length;

  const tiles = [...featured, ...archive];
  const categories = [...new Set(tiles.map((tile) => tile.dataset.category).filter(Boolean))];
  const filters = byId("project-filters");
  filters.hidden = categories.length <= 1;
  if (filters.hidden) return;

  const buttons = ["", ...categories].map((category) => {
    const button = element("button", "", category || "All");
    button.type = "button";
    button.setAttribute("aria-pressed", String(!category));
    button.addEventListener("click", () => {
      for (const tile of tiles) tile.hidden = Boolean(category && tile.dataset.category !== category);
      more.hidden = !archive.some((tile) => !tile.hidden);
      for (const control of buttons) control.setAttribute("aria-pressed", String(control === button));
    });
    return button;
  });
  filters.replaceChildren(...buttons);
}

function render(data, snapshots) {
  const { profile, research, sources = {}, personal = {} } = data;
  const scholar = /^[\w-]+$/.test(sources.scholarId || "")
    ? `https://scholar.google.com/citations?user=${sources.scholarId}&hl=en` : "";
  const orcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(sources.orcid || "")
    ? `https://orcid.org/${sources.orcid}` : "";
  const bilibili = /^\d+$/.test(sources.bilibiliUid || "") ? `https://space.bilibili.com/${sources.bilibiliUid}` : "";
  const links = [
    { label: "Google Scholar", url: scholar },
    ...(data.links || []),
    { label: "ORCID", url: orcid },
    { label: "Bilibili", url: bilibili },
  ].filter((item) => item?.label && contentUrl(item.url)).map(({ label, url }) => ({ label, url: contentUrl(url) }));
  const email = emailUrl(profile?.email);
  if (email) links.push({ label: "Email", url: email });
  renderProfile(profile, links);
  renderResearch(research || {}, profile);

  const curatedPapers = itemsWithTitle(data.publications);
  const extraPapers = newEntries(curatedPapers, importedItems(snapshots.publications, sources), sources.hiddenPublications);
  renderPublications(curatedPapers, extraPapers, scholar);

  const articles = itemsWithTitle(data.news);
  renderNews(articles);

  const projects = itemsWithTitle(data.projects);
  const videos = newEntries(projects, importedItems(snapshots.videos, sources), sources.hiddenVideos);
  renderProjects(projects, videos, bilibili);

  const photos = photosWithImages(data.photos);
  showSection("photos", Boolean(photos.length || personal.quote));
  byId("photos-heading").hidden = !photos.length;
  byId("gallery-link").hidden = !photos.length;
  setList("photo-list", featuredPhotos(photos), (item) => photoTile(item));
  textAt("personal-quote", personal.quote);
  byId("project-quote").hidden = !personal.quote;

  const experience = itemsWithTitle(data.experience);
  showSection("Experience", Boolean(personal.interests || personal.skills || experience.length));
  byId("interests-note").hidden = !personal.interests;
  byId("skills-note").hidden = !personal.skills;
  textAt("interests", personal.interests);
  textAt("skills", personal.skills);
  byId("honours").hidden = !experience.length;
  setList("experience-list", experience, (item) => listItem(
    item.year && element("span", "experience-year", item.year),
    element("strong", "", item.title),
    item.detail && element("p", "", item.detail),
  ));
}

setupMenu();

try {
  const [data, snapshots] = await Promise.all([
    readJson("api/content.json"),
    readJson("api/imports.json").catch(() => ({})),
  ]);
  render(data, snapshots || {});
  if (location.hash) byId(location.hash.slice(1))?.scrollIntoView();
} catch (error) {
  console.error(error);
  byId("load-error").hidden = false;
}
