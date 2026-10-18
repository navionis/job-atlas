export function Spinner({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={"orbit-loader" + (size <= 24 ? " compact" : "") + (className ? " " + className : "")}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="32" cy="32" r="19" className="o-globe" />
      <g>
        <ellipse cx="32" cy="32" rx="8.5" ry="19" className="o-globe" />
        <ellipse cx="32" cy="32" rx="8.5" ry="19" transform="rotate(55 32 32)" className="o-globe" />
        <path d="M13.3 31 Q32 38 50.7 31" className="o-globe" />
        <path d="M15.6 22.5 Q32 28 48.4 22.5" className="o-globe" />
        <path d="M15.6 41.5 Q32 36 48.4 41.5" className="o-globe" />
      </g>
      <circle cx="32" cy="32" r="28" className="o-track" />
      <defs>
        <linearGradient id="o-tail-g" gradientUnits="userSpaceOnUse" x1="54.4" y1="48.9" x2="34.9" y2="59.9">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <g className="o-spin">
        <path d="M54.4 48.9 A30.2 30.2 0 0 1 35.2 62 L34.7 57.7 A25.8 25.8 0 0 0 54.4 48.9 Z" fill="url(#o-tail-g)" />
        <circle cx="51.8" cy="51.8" r="0.9" className="o-p3" />
        <circle cx="46.8" cy="55.7" r="1.2" className="o-p2" />
        <circle cx="40.7" cy="58.6" r="1.7" className="o-p1" />
        <circle cx="33.8" cy="60" r="6.5" className="o-halo" />
        <circle cx="33.8" cy="60" r="3.4" className="o-moon" />
      </g>
    </svg>
  );
}
