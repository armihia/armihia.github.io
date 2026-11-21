import { readJson } from "./content.js";
import { photosWithImages, photoTile } from "./photos.js";
import { applySiteCopy, siteCopy } from "./site-copy.js";

const status = document.getElementById("gallery-status");
let copy = siteCopy();
try {
  const data = await readJson("../api/content.json");
  copy = siteCopy(data);
  const photographer = document.getElementById("photographer-name");
  const name = data.profile?.name || photographer.textContent;
  photographer.textContent = name;
  applySiteCopy(copy, { name, heading: copy.photography.heading });
  const photos = photosWithImages(data.photos);
  document.getElementById("gallery-list").replaceChildren(...photos.map((item) => photoTile(item, "../", copy.photography.photoAlt)));
  if (!photos.length) {
    status.textContent = copy.photography.empty;
    status.hidden = false;
  }
} catch (error) {
  console.error(error);
  status.textContent = copy.photography.loadError;
  status.hidden = false;
}
