export const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/";
export const discordUrl = "https://discord.gg/x5mWWZH4";
export const baseScanUrl = "https://sepolia.basescan.org";

export type SiteNavPage = "home" | "market" | "whitepaper";

export type SiteNavItem = {
  href: string;
  label: string;
  page?: SiteNavPage;
  external?: boolean;
};

export function getSiteNavItems(includeHome: boolean): SiteNavItem[] {
  const items: SiteNavItem[] = [];

  if (includeHome) {
    items.push({ href: "/", label: "Home", page: "home" });
  }

  items.push(
    { href: "/market", label: "Market", page: "market" },
    { href: "/whitepaper", label: "Whitepaper", page: "whitepaper" },
    { href: githubUrl, label: "GitHub", external: true },
    { href: discordUrl, label: "Discord", external: true },
    { href: baseScanUrl, label: "BaseScan", external: true },
  );

  return items;
}
