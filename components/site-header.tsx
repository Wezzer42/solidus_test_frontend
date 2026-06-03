import { SolidusLogo } from "./solidus-logo";

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/";
const discordUrl = "https://discord.gg/x5mWWZH4";
const baseScan = "https://sepolia.basescan.org";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[#d6e2ff] pb-4">
      <SolidusLogo />
      <nav className="hidden items-center gap-5 text-sm font-medium text-[#3f5ea8] sm:flex">
        <a href="/market">Market</a>
        <a href="/whitepaper">Whitepaper</a>
        <a href={githubUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={discordUrl} target="_blank" rel="noreferrer">
          Discord
        </a>
        <a href={baseScan} target="_blank" rel="noreferrer">
          BaseScan
        </a>
      </nav>
    </header>
  );
}
