import Link from "next/link";

const sections = [
  ["FLOW", "Liquid settlement token. FLOW moves freely, pays a small protocol fee, and feeds Reserve pressure."],
  ["PRIME", "Reserve-power token. PRIME is earned through FLOW circulation and cannot transfer wallet-to-wallet."],
  ["Reserve", "Protocol-held FLOW. It accumulates fees and inactivity pressure, then releases FLOW through PRIME redemption."],
  ["Core law", "PRIME only moves through FLOW settlement. Direct PRIME transfer and approval are disabled."],
  ["Launch", "v2 starts with 50% FLOW pre-seeded into Reserve and founder PRIME excluded from public emission saturation."],
  ["Risk", "This is a public economic experiment, not a stablecoin, not PoW, and not a finished monetary system."],
];

const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/";

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-[#e9e2d0] px-3 py-4 text-[#17130d] sm:px-5">
      <section className="mx-auto max-w-5xl border-2 border-[#17130d] bg-[#f6f0df] p-5 shadow-[8px_8px_0_#17130d] sm:p-8">
        <p className="w-fit bg-[#17130d] px-3 py-2 text-xs font-black uppercase tracking-[0.32em] text-[#f6f0df]">
          docs / live-test draft
        </p>
        <h1 className="mt-8 font-display text-6xl font-black uppercase leading-[0.85] tracking-[-0.09em] sm:text-8xl">
          Solidus
          <span className="block text-[#ff6b2b]">Whitepaper</span>
        </h1>
        <p className="mt-6 max-w-3xl border-l-4 border-[#17130d] pl-5 text-xl font-semibold leading-8 text-[#332b20]">
          Value is not mined. Value emerges through circulation. FLOW moves. PRIME stores reserve influence.
        </p>

        <div className="mt-10 grid gap-0 border-2 border-[#17130d] md:grid-cols-2">
          {sections.map(([title, text]) => (
            <article className="border-b-2 border-[#17130d] p-5 odd:md:border-r-2" key={title}>
              <h2 className="font-display text-3xl font-black uppercase tracking-[-0.08em]">{title}</h2>
              <p className="mt-3 font-semibold leading-7 text-[#5a5145]">{text}</p>
            </article>
          ))}
        </div>

        <p className="mt-6 text-sm font-bold text-[#6f6758]">
          Canonical full text lives in the protocol repository at <code>docs/WHITEPAPER.md</code>.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn-primary" href="/">
            Back to app
          </Link>
          <a className="btn-secondary" href={githubUrl} target="_blank">
            GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
