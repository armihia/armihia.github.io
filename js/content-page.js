import { readJson } from "./content.js";
import { applySiteCopy, siteCopy } from "./site-copy.js";

try {
  applySiteCopy(siteCopy(await readJson("api/content.json")));
} catch (error) {
  console.error(error);
}
