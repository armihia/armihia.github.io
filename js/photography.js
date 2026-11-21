import { readJson } from "./content.js";
import { photosWithImages, photoTile } from "./photos.js";

const status = document.getElementById("gallery-status");
try {
  const data = await readJson("../api/content.json");
  const name = data.profile?.name;
  if (name) {
    document.title = `Photography - ${name}`;
    document.getElementById("photographer-name").textContent = name;
  }
  const photos = photosWithImages(data.photos);
  document.getElementById("gallery-list").replaceChildren(...photos.map((item) => photoTile(item, "../")));
  if (!photos.length) {
    status.textContent = "No photographs yet.";
    status.hidden = false;
  }
} catch (error) {
  console.error(error);
  status.textContent = "The photographs could not be loaded. Please try again.";
  status.hidden = false;
}
