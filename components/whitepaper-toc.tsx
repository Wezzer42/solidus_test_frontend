import type { WhitepaperTocEntry } from "../lib/whitepaper";

export function WhitepaperToc({ entries }: { entries: WhitepaperTocEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0052ff]">Contents</p>
      <ul className="mt-4 space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className={entry.level === 3 ? "pl-4" : undefined}>
            <a
              href={`#${entry.id}`}
              className="font-semibold text-[#496ab3] transition hover:text-[#0052ff]"
            >
              {entry.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
