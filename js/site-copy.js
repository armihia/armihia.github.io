const defaults = {
  site: {
    documentTitle: "{name} - Personal website",
    description: "{name}, PhD researcher at the University of Exeter. Research on generative agents, simulated experience, and computational models of cognition and consciousness.",
    skipToContent: "Skip to content",
    menu: "Menu",
    closeMenu: "Close",
    menuLabel: "Site menu",
    siteNavigation: "Site",
    homepageNavigation: "Homepage sections",
    switchPortrait: "Switch profile photo",
    editSite: "Edit site",
    loadError: "The latest site content is unavailable. Please reload the page to try again.",
    googleScholar: "Google Scholar",
    orcid: "ORCID",
    bilibili: "Bilibili",
    email: "Email",
  },
  navigation: {
    home: "Home",
    about: "About Me",
    news: "News",
    publications: "Articles",
    experience: "Experience",
    projects: "Projects",
    photos: "Photos",
    contact: "Contact Me",
  },
  about: {
    heading: "About Me",
    relatedWork: "Related work",
    portraitAlt: "Portrait",
    roleAtInstitution: "{role} at the {institution}",
    affiliation: "{position}.",
    affiliationWithSupervisor: "{position}, supervised by {supervisor}.",
    supervisor: "Supervised by {supervisor}.",
  },
  news: {
    heading: "News",
    carousel: "carousel",
    slides: "News slides",
    navigation: "Select a news item",
    showSlide: "Show {title}",
  },
  publications: {
    heading: "Research Publications",
    latestPreprints: "Latest Preprints",
    latestPublications: "Latest Publications",
    otherPublications: "Other Publications",
    summary: "Summary",
    pdf: "PDF",
    pdfLabel: "{label} · {title}",
    figure: "Figure",
    figureAlt: "Figure from {title}",
    openFigure: "Open figure",
  },
  experience: {
    heading: "Experience",
    interests: "Interests",
    programming: "Programming",
    honours: "Honours & Experience",
  },
  projects: {
    heading: "Projects & Videos",
    filters: "Filter projects",
    all: "All",
    moreVideos: "More videos",
  },
  photography: {
    heading: "Photography",
    viewAll: "View all photographs",
    backToHomepage: "Back to homepage",
    documentTitle: "{heading} - {name}",
    description: "Photographs by {name}.",
    empty: "No photographs yet.",
    loadError: "The photographs could not be loaded. Please try again.",
    photoAlt: "Photograph",
    quote: "",
  },
  contact: {
    heading: "Contact Me",
    link: "Contact Me",
  },
  interview: {
    title: "MIT Technology Review Interview",
    credit: "Cite from MIT Technology Review (China) https://www.mittrchina.com/",
    originalLink: "Original link:",
  },
  paperViewer: {
    title: "ITCMA-S",
    openPdf: "Open the ITCMA-S PDF",
    pdfTitle: "ITCMA-S paper",
  },
};

// These fields also have dedicated controls in the content editor.
export const contentCopyFields = {
  "about.heading": ["research", "heading"],
  "about.relatedWork": ["research", "linksTitle"],
  "photography.quote": ["personal", "quote"],
};

function validText(value, path) {
  return typeof value === "string" && (path === "photography.quote" || Boolean(value.trim()));
}

export function siteCopy(content = {}) {
  return Object.fromEntries(Object.entries(defaults).map(([group, fields]) => [
    group, Object.fromEntries(Object.entries(fields).map(([key, fallback]) => {
      const path = `${group}.${key}`;
      const field = contentCopyFields[path];
      const value = field ? content?.[field[0]]?.[field[1]] : content?.ui?.[group]?.[key];
      return [key, validText(value, path) ? value.trim() : fallback];
    })),
  ]));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function importSiteCopy(content, input) {
  if (!isObject(input)) throw new Error("文案文件的最外层必须是 JSON 对象。");
  const current = siteCopy(content);
  const changes = [];
  for (const [group, fields] of Object.entries(input)) {
    if (!Object.hasOwn(defaults, group)) throw new Error(`找不到文案分组「${group}」`);
    if (!isObject(fields)) throw new Error(`「${group}」需要是 JSON 对象。`);
    for (const [key, value] of Object.entries(fields)) {
      const path = `${group}.${key}`;
      if (!Object.hasOwn(defaults[group], key)) throw new Error(`找不到文案字段「${path}」`);
      if (!validText(value, path)) {
        throw new Error(path === "photography.quote" ? `「${path}」需要是字符串。` : `「${path}」需要是非空字符串。`);
      }
      if (current[group][key] !== value.trim()) changes.push({ group, key, path, value: value.trim() });
    }
  }

  for (const { group, key, path, value } of changes) {
    const field = contentCopyFields[path];
    if (field) (content[field[0]] ??= {})[field[1]] = value;
    else {
      const copy = isObject(content.ui) ? content.ui : (content.ui = {});
      const section = isObject(copy[group]) ? copy[group] : (copy[group] = {});
      section[key] = value;
    }
  }
  return changes.map(({ path }) => path);
}

export function copyParts(template, values = {}) {
  return template.split(/(\{[a-zA-Z]+\})/).map((part, index) => {
    const key = part.slice(1, -1);
    return index % 2 && Object.hasOwn(values, key) ? values[key] : part;
  });
}

export function formatCopy(template, values) {
  return copyParts(template, values).join("");
}

export function applySiteCopy(copy, values) {
  const bindings = {
    "data-copy": "textContent",
    "data-copy-label": "aria-label",
    "data-copy-role": "aria-roledescription",
    "data-copy-title": "title",
    "data-copy-content": "content",
  };
  for (const [binding, attribute] of Object.entries(bindings)) {
    for (const node of document.querySelectorAll(`[${binding}]`)) {
      const [group, key] = node.getAttribute(binding).split(".");
      const template = copy[group]?.[key];
      if (typeof template !== "string") continue;
      const value = formatCopy(template, values);
      if (attribute === "textContent") node.textContent = value;
      else node.setAttribute(attribute, value);
    }
  }
}
