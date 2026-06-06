import Link from "next/link";
import { getSiteNavItems, type SiteNavPage } from "../lib/site-nav";

function NavLink({
  href,
  label,
  external,
  active,
  className,
}: {
  href: string;
  label: string;
  external?: boolean;
  active?: boolean;
  className?: string;
}) {
  const linkClass = active
    ? "font-bold text-[#0052ff]"
    : "text-[#3f5ea8] transition hover:text-[#0052ff]";

  if (external) {
    return (
      <a className={`${linkClass} ${className ?? ""}`} href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  return (
    <Link className={`${linkClass} ${className ?? ""}`} href={href}>
      {label}
    </Link>
  );
}

export function SiteNavLinks({
  activePage,
  includeHome = false,
  className,
  linkClassName,
}: {
  activePage?: SiteNavPage;
  includeHome?: boolean;
  className?: string;
  linkClassName?: string;
}) {
  const items = getSiteNavItems(includeHome);

  return (
    <nav className={className}>
      {items.map((item) => (
        <NavLink
          key={item.label}
          href={item.href}
          label={item.label}
          external={item.external}
          active={item.page !== undefined && item.page === activePage}
          className={linkClassName}
        />
      ))}
    </nav>
  );
}

export function SiteMobileNav({
  activePage,
  includeHome = false,
}: {
  activePage?: SiteNavPage;
  includeHome?: boolean;
}) {
  return (
    <details className="w-full sm:hidden">
      <summary className="cursor-pointer list-none text-sm font-bold text-[#0052ff] marker:content-none [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <SiteNavLinks
        activePage={activePage}
        includeHome={includeHome}
        className="mt-3 flex flex-col gap-3 border-t border-[#d6e2ff] pt-3 text-sm font-medium"
      />
    </details>
  );
}
