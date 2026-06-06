import { SolidusLogo } from "./solidus-logo";
import { SiteMobileNav, SiteNavLinks } from "./site-nav-links";
import type { SiteNavPage } from "../lib/site-nav";

export function SiteHeader({ activePage }: { activePage?: SiteNavPage }) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#d6e2ff] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <SolidusLogo />
      <SiteNavLinks
        activePage={activePage}
        className="hidden items-center gap-5 text-sm font-medium sm:flex"
      />
      <SiteMobileNav activePage={activePage} />
    </header>
  );
}
