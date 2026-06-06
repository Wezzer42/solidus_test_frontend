type TokenMarkProps = {
  token: "FLOW" | "PRIME";
  className?: string;
};

export function TokenMark({ token, className = "size-8" }: TokenMarkProps) {
  const isPrime = token === "PRIME";
  const gradientId = isPrime ? "prime-gold" : "flow-silver";
  const shadow = isPrime ? "#8a5600" : "#71809b";

  return (
    <svg
      aria-label={`${token} token`}
      className={className}
      viewBox="0 0 64 64"
      role="img"
    >
      <defs>
        <radialGradient id={`${gradientId}-base`} cx="32%" cy="24%" r="78%">
          <stop offset="0%" stopColor={isPrime ? "#fff2a8" : "#ffffff"} />
          <stop offset="46%" stopColor={isPrime ? "#e4b63f" : "#c9d0da"} />
          <stop offset="100%" stopColor={isPrime ? "#9b6500" : "#78869d"} />
        </radialGradient>
        <linearGradient id={`${gradientId}-mark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isPrime ? "#fff8c7" : "#ffffff"} />
          <stop offset="55%" stopColor={isPrime ? "#f1c44f" : "#dce2ea"} />
          <stop offset="100%" stopColor={isPrime ? "#b87800" : "#929fb2"} />
        </linearGradient>
        <filter id={`${gradientId}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={shadow} floodOpacity=".45" />
        </filter>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${gradientId}-base)`} />
      <circle cx="32" cy="32" r="23" fill="#101a38" opacity=".94" />
      <g fill={`url(#${gradientId}-mark)`} filter={`url(#${gradientId}-shadow)`}>
        <path d="M32 7a25 25 0 1 0 0 50 25 25 0 0 0 0-50Zm0 7a18 18 0 1 1 0 36 18 18 0 0 1 0-36Z" />
        <circle cx="32" cy="32" r="7.5" />
      </g>
    </svg>
  );
}
