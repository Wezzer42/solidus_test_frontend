import Image from "next/image";
import Link from "next/link";
import solidusLogo from "../src/solidus.png";

type SolidusLogoProps = {
  href?: string;
  showText?: boolean;
  className?: string;
};

export function SolidusLogo({ href = "/", showText = true, className }: SolidusLogoProps) {
  const content = (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <Image src={solidusLogo} alt="Solidus" width={36} height={36} className="size-9" priority />
      {showText && <div className="font-display text-xl font-black tracking-[-0.06em]">Solidus</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="w-fit">
        {content}
      </Link>
    );
  }

  return content;
}
