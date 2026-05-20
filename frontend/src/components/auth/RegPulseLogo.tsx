import Link from "next/link";

type RegPulseLogoProps = {
  href?: string;
  size?: "sm" | "md";
  className?: string;
};

export function RegPulseLogo({ href = "/", size = "md", className = "" }: RegPulseLogoProps) {
  const boxSize = size === "sm" ? "h-[34px] w-[34px] text-base" : "h-10 w-10 text-lg";
  const wordSize = size === "sm" ? "text-[19px]" : "text-2xl";

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg bg-reg-navy font-serif ${boxSize} text-reg-gold-light`}
      >
        R
      </div>
      <span className={`font-serif tracking-wide text-reg-navy ${wordSize}`}>
        Reg<span className="text-reg-gold">Pulse</span>
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
