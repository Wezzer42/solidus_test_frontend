import fs from "fs";
import path from "path";

const whitepaperPath = path.join(process.cwd(), "content/WHITEPAPER.md");

export function getWhitepaperMarkdown() {
  return fs.readFileSync(whitepaperPath, "utf8");
}

export type WhitepaperTocEntry = {
  level: 2 | 3;
  title: string;
  id: string;
};

export function slugifyHeading(title: string) {
  return title
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function getWhitepaperToc(markdown: string): WhitepaperTocEntry[] {
  const entries: WhitepaperTocEntry[] = [];

  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length as 2 | 3;
    const title = match[2].replace(/\*\*/g, "").trim();
    entries.push({ level, title, id: slugifyHeading(title) });
  }

  return entries;
}
