import { contentUrl } from "./content.js";

export function photosWithImages(items) {
  return Array.isArray(items) ? items.filter((item) => contentUrl(item?.image)) : [];
}

export function featuredPhotos(photos) {
  const selected = photos.some((item) => typeof item.featured === "boolean")
    ? photos.filter((item) => item.featured === true)
    : photos;
  return selected.slice(0, 3);
}

export function photoTile(item, prefix = "", fallbackAlt = "Photograph") {
  const url = contentUrl(item.image);
  const source = url.startsWith("https://") ? url : prefix + url;
  const img = document.createElement("img");
  img.src = source;
  img.alt = item.alt || item.caption || fallbackAlt;
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";

  const full = document.createElement("a");
  full.href = source;
  full.append(img);
  const figure = document.createElement("figure");
  figure.append(full);
  if (item.caption) {
    const caption = document.createElement("figcaption");
    caption.textContent = item.caption;
    figure.append(caption);
  }
  const tile = document.createElement("li");
  tile.append(figure);
  return tile;
}
