import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EconomicCycleDiagram } from "./economic-cycle-diagram";
import { slugifyHeading } from "../lib/whitepaper";

function headingText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(headingText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return headingText((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-4xl font-black tracking-[-0.07em] text-[#0b1736] sm:text-5xl">{children}</h1>
  ),
  h2: ({ children }) => {
    const id = slugifyHeading(headingText(children));
    return (
      <h2
        id={id}
        className="scroll-mt-24 border-t border-[#d6e2ff] pt-10 font-display text-2xl font-black tracking-[-0.06em] text-[#0b1736] first:border-t-0 first:pt-0 sm:text-3xl"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }) => {
    const id = slugifyHeading(headingText(children));
    return (
      <h3 id={id} className="scroll-mt-24 mt-8 font-display text-xl font-black tracking-[-0.05em] text-[#0b1736]">
        {children}
      </h3>
    );
  },
  p: ({ children }) => <p className="mt-4 text-base leading-7 text-[#335aa8]">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6 text-[#335aa8]">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-[#335aa8]">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-[#0b1736]">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-semibold text-[#0052ff] underline decoration-[#9cb8ff] underline-offset-2 hover:decoration-[#0052ff]"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-6 border-l-4 border-[#0052ff] bg-[#eaf0ff] py-1 pl-5 pr-4 text-[#0b1736]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-[#d6e2ff]" />,
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto rounded-xl border border-[#cddcff]">
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#eaf0ff] text-[#0b1736]">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-[#d6e2ff] bg-white">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-3 font-bold text-[#0b1736]">{children}</th>
  ),
  td: ({ children }) => <td className="px-4 py-3 font-medium text-[#335aa8]">{children}</td>,
  code: ({ className, children }) => {
    const language = className?.replace("language-", "") ?? "";
    const text = String(children).replace(/\n$/, "");

    if (language === "mermaid") {
      return <EconomicCycleDiagram />;
    }

    if (className) {
      return (
        <pre className="mt-4 overflow-x-auto rounded-xl border border-[#cddcff] bg-[#0b1736] p-4 text-sm leading-6 text-[#eaf0ff]">
          <code>{text}</code>
        </pre>
      );
    }

    return (
      <code className="rounded bg-[#eaf0ff] px-1.5 py-0.5 font-mono text-sm font-semibold text-[#0b1736]">{children}</code>
    );
  },
};

export function WhitepaperMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
