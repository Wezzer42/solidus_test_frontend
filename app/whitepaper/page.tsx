import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { WhitepaperMarkdown } from "../../components/whitepaper-markdown";
import { WhitepaperToc } from "../../components/whitepaper-toc";
import { getWhitepaperMarkdown, getWhitepaperToc } from "../../lib/whitepaper";

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/";
const discordUrl = "https://discord.gg/x5mWWZH4";

export const metadata: Metadata = {
  title: "Whitepaper | Solidus Testnet",
  description: "Solidus Protocol whitepaper — FLOW circulation, PRIME reserve power, and live-test economics.",
};

export default function WhitepaperPage() {
  const content = getWhitepaperMarkdown();
  const toc = getWhitepaperToc(content);

  return (
    <main className="min-h-screen bg-[#f3f7ff] text-[#0b1736]">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <SiteHeader />

        <details className="mt-6 rounded-xl border border-[#dce7ff] bg-white p-4 lg:hidden">
          <summary className="cursor-pointer text-sm font-bold text-[#0052ff]">Table of contents</summary>
          <div className="mt-4">
            <WhitepaperToc entries={toc} />
          </div>
        </details>

        <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <WhitepaperToc entries={toc} />
          </aside>

          <article className="min-w-0 rounded-2xl border border-[#dce7ff] bg-white p-6 sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#0052ff]">Solidus Protocol</p>
            <div className="mt-6">
              <WhitepaperMarkdown content={content} />
            </div>
            <footer className="mt-12 flex flex-wrap gap-3 border-t border-[#d6e2ff] pt-8">
              <Link href="/" className="btn-primary">
                Back to app
              </Link>
              <a className="btn-secondary" href={githubUrl} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a className="btn-secondary" href={discordUrl} target="_blank" rel="noreferrer">
                Discord
              </a>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
