import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadGuideMarkdown(): Promise<string> {
  const file = path.join(process.cwd(), "src/content/kootenay-field-guide.md");
  return readFile(file, "utf8");
}
