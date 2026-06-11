import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { injectGuideImages } from "./images";

export async function loadGuideMarkdown(): Promise<string> {
  const file = path.join(process.cwd(), "src/content/kootenay-field-guide.md");
  const raw = await readFile(file, "utf8");
  return injectGuideImages(raw);
}
