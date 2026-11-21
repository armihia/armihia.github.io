import { contentUrl, emailUrl, importedItems, introductionBody, itemsWithTitle, newEntries, readJson } from "./content.js";
import { featuredPhotos, photosWithImages, photoTile } from "./photos.js";
import { groupPublications, publicationDate } from "./publications.js";
import { applySiteCopy, copyParts, formatCopy, siteCopy } from "./site-copy.js";

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

function markdownNodes(tokens) {
  const fragment = document.createDocumentFragment();
  for (const token of tokens) {
    switch (token.type) {
      case "strong":
      case "em":
      case "del": {
        const styled = element(token.type);
        styled.append(markdownNodes(token.tokens));
        fragment.append(styled);
        break;
      }
      case "link": {
        const url = contentUrl(token.href);
        if (url) {
          const anchor = link("", url);
          if (token.title) anchor.title = token.title;
          anchor.append(markdownNodes(token.tokens));
          fragment.append(anchor);
        } else fragment.append(token.raw);
        break;
      }
      case "codespan":
        fragment.append(element("code", "", token.text));
        break;
      case "br":
        fragment.append(element("br"));
        break;
      case "text":
      case "escape":
        fragment.append(token.text);
        break;
      default:
        fragment.append(token.raw);
    }
  }
  return fragment;
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

function renderPortrait(profile) {
  const portrait = byId("portrait");
  const photos = [
    { url: contentUrl(profile.image), alt: profile.imageAlt },
    { url: contentUrl(profile.secondaryImage), alt: profile.secondaryImageAlt },
  ].filter(({ url }) => url);
  portrait.hidden = !photos.length;
  if (!photos.length) return;

  let photo = portrait.querySelector("img");
  const description = byId("portrait-description");
  const canSwitch = photos.length === 2 && photos[0].url !== photos[1].url;
  let index = canSwitch && profile.defaultPortrait === "secondary" ? 1 : 0;
  let switching = false;
  let descriptionTimer;

  function updateDescription() {
    const { alt } = photos[index];
    const text = typeof alt === "string" ? alt.trim() : "";
    photo.alt = text || profile.name;
    if (description) {
      description.textContent = text;
      description.hidden = true;
      if (text) photo.tabIndex = 0;
      else photo.removeAttribute("tabindex");
    }
  }

  function showDescription() {
    if (description) description.hidden = !description.textContent;
  }

  const initialPhoto = photo;
  photo.src = photos[index].url;
  updateDescription();
  photo.decode().then(() => {
    if (!switching && photo === initialPhoto) showDescription();
  }, () => {});

  const toggle = byId("portrait-switch");
  if (!toggle || !canSwitch) return;
  toggle.hidden = false;
  toggle.addEventListener("click", async () => {
    if (switching) return;
    switching = true;
    toggle.setAttribute("aria-busy", "true");
    clearTimeout(descriptionTimer);
    if (description) description.hidden = true;

    const nextIndex = 1 - index;
    const nextPhoto = photo.cloneNode(false);
    nextPhoto.src = photos[nextIndex].url;
    try {
      await nextPhoto.decode();
      const restoreFocus = document.activeElement === photo;
      photo.replaceWith(nextPhoto);
      photo = nextPhoto;
      index = nextIndex;
      updateDescription();
      if (restoreFocus && photo.tabIndex === 0) photo.focus({ preventScroll: true });
      descriptionTimer = setTimeout(showDescription, 170);
    } catch {
      if (photo.complete && photo.naturalWidth) showDescription();
    } finally {
      switching = false;
      toggle.removeAttribute("aria-busy");
    }
  });
}

function renderProfile(profile, links, labels) {
  if (!profile?.name) return;
  document.querySelectorAll("[data-profile-name]").forEach((el) => { el.textContent = profile.name; });
  textAt("field", profile.field);

  const affiliation = byId("affiliation");
  const institutionUrl = contentUrl(profile.institutionUrl);
  const supervisorUrl = contentUrl(profile.supervisorUrl);
  const institution = institutionUrl && profile.institution ? link(profile.institution, institutionUrl) : profile.institution;
  const supervisor = supervisorUrl && profile.supervisor ? link(profile.supervisor, supervisorUrl) : profile.supervisor;
  const role = profile.role;
  const position = role && institution ? copyParts(labels.roleAtInstitution, { role, institution }) : [role || institution].filter(Boolean);
  const sentence = supervisor ? (position.length ? labels.affiliationWithSupervisor : labels.supervisor) : labels.affiliation;
  const parts = position.length || supervisor ? copyParts(sentence, { position, supervisor: supervisor || "" }).flat() : [];
  affiliation.replaceChildren(...parts.map((part) => part instanceof Node ? part.cloneNode(true) : part));
  affiliation.hidden = !affiliation.textContent.trim();

  renderPortrait(profile);

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

function renderResearch(research, profile, labels) {
  const affiliation = byId("affiliation");
  const suffix = typeof research.affiliationSuffix === "string" ? research.affiliationSuffix.trim() : "";
  if (suffix) {
    if (affiliation.textContent.trim()) affiliation.append(" ");
    const extra = element("span", "affiliation-suffix", suffix);
    extra.hidden = true;
    affiliation.append(extra);
    import("./vendor/marked.esm.js")
      .then(({ Lexer }) => extra.replaceChildren(markdownNodes(Lexer.lexInline(suffix))))
      .catch((error) => console.error(error))
      .finally(() => { extra.hidden = false; });
  }
  affiliation.hidden = research.showAffiliation === false || !affiliation.textContent.trim();
  const paragraphs = introductionBody(research).split(/\r?\n[\t ]*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const body = byId("research-body");
  body.replaceChildren(...paragraphs.map((paragraph) => element("p", "", paragraph)));
  body.hidden = !paragraphs.length;

  const photo = image(research.image, research.imageAlt || profile?.name || labels.portraitAlt);
  const photoFrame = byId("about-photo");
  photoFrame.replaceChildren(...(photo ? [photo] : []));
  photoFrame.hidden = !photo;
  byId("about-layout").classList.toggle("with-photo", Boolean(photo));

  const papers = Array.isArray(research.papers) ? research.papers.filter((paper) => paper?.label && contentUrl(paper.url)) : [];
  setList("research-papers", papers, (paper) => listItem(
    link(paper.label, contentUrl(paper.url)),
    paper.note && element("span", "", ` · ${paper.note}`),
  ));
  document.querySelector(".research-reading").hidden = !papers.length;
  showSection("aboutme", Boolean(photo || !affiliation.hidden || paragraphs.length || papers.length));
}

function publication(paper, featured, labels) {
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
    const attachment = link(labels.pdf, pdf);
    attachment.setAttribute("aria-label", formatCopy(labels.pdfLabel, { label: labels.pdf, title: paper.title }));
    links.append(attachment);
  }
  const figureUrl = contentUrl(paper.image);
  if (!featured && figureUrl) links.append(link(labels.figure, figureUrl));
  if (links.children.length) copy.append(links);
  if (paper.summary) {
    const details = element("details", "paper-summary");
    details.append(element("summary", "", labels.summary), element("p", "", paper.summary));
    copy.append(details);
  }
  if (featured) {
    const figure = image(paper.image, paper.figureAlt || formatCopy(labels.figureAlt, { title: paper.title }));
    const cover = figure ? link("", figureUrl) : null;
    if (cover) {
      cover.className = "paper-figure";
      cover.append(figure);
      figure.addEventListener("error", () => {
        cover.classList.add("paper-figure-unavailable");
        cover.textContent = labels.openFigure;
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

function renderPublications(curated, imported, scholar, labels) {
  const groups = groupPublications(curated, imported);
  for (const status of ["preprint", "published"]) {
    const recent = groups[status];
    byId(`${status}-group`).hidden = !recent.length;
    setList(`${status}-list`, recent, (paper) => publication(paper, true, labels));
  }

  byId("more-publications").hidden = !groups.other.length;
  setList("earlier-publications", groups.other, (paper) => publication(paper, false, labels));
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

function renderNews(articles, labels) {
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
    dot.setAttribute("aria-label", formatCopy(labels.showSlide, { title: item.title }));
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

function renderProjects(projects, videos, bilibili, labels) {
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
    const button = element("button", "", category || labels.all);
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
  const copy = siteCopy(data);
  applySiteCopy(copy, { name: profile?.name || byId("name").textContent });
  const scholar = /^[\w-]+$/.test(sources.scholarId || "")
    ? `https://scholar.google.com/citations?user=${sources.scholarId}&hl=en` : "";
  const orcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(sources.orcid || "")
    ? `https://orcid.org/${sources.orcid}` : "";
  const bilibili = /^\d+$/.test(sources.bilibiliUid || "") ? `https://space.bilibili.com/${sources.bilibiliUid}` : "";
  const links = [
    { label: copy.site.googleScholar, url: scholar },
    ...(data.links || []),
    { label: copy.site.orcid, url: orcid },
    { label: copy.site.bilibili, url: bilibili },
  ].filter((item) => item?.label && contentUrl(item.url)).map(({ label, url }) => ({ label, url: contentUrl(url) }));
  const email = emailUrl(profile?.email);
  if (email) links.push({ label: copy.site.email, url: email });
  renderProfile(profile, links, copy.about);
  renderResearch(research || {}, profile, copy.about);

  const curatedPapers = itemsWithTitle(data.publications);
  const extraPapers = newEntries(curatedPapers, importedItems(snapshots.publications, sources), sources.hiddenPublications);
  renderPublications(curatedPapers, extraPapers, scholar, copy.publications);

  const articles = itemsWithTitle(data.news);
  renderNews(articles, copy.news);

  const projects = itemsWithTitle(data.projects);
  const videos = newEntries(projects, importedItems(snapshots.videos, sources), sources.hiddenVideos)
    .map((video) => video.category === "Bilibili" ? { ...video, category: copy.site.bilibili } : video);
  renderProjects(projects, videos, bilibili, copy.projects);

  const photos = photosWithImages(data.photos);
  const { quote, photoAlt } = copy.photography;
  showSection("photos", Boolean(photos.length || quote));
  byId("photos-heading").hidden = !photos.length;
  byId("gallery-link").hidden = !photos.length;
  setList("photo-list", featuredPhotos(photos), (item) => photoTile(item, "", photoAlt));
  textAt("personal-quote", quote);
  byId("project-quote").hidden = !quote;

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
