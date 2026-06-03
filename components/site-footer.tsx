const authorGithub = "https://github.com/Wezzer42";
const authorLinkedIn = "https://www.linkedin.com/in/azat-alibaev";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#d6e2ff] bg-[#f3f7ff] px-4 py-6 text-center text-sm text-[#496ab3] sm:px-6">
      <p>
        Built by{" "}
        <span className="font-semibold text-[#0b1736]">Azat Alibaev</span>
      </p>
      <div className="mt-2 flex items-center justify-center gap-4 font-medium">
        <a
          className="text-[#0052ff] transition hover:underline"
          href={authorGithub}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a
          className="text-[#0052ff] transition hover:underline"
          href={authorLinkedIn}
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
      </div>
    </footer>
  );
}
