export function Spinner({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={"atlas-spin " + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <ellipse cx="12" cy="12" rx="4.5" ry="9.5" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.4" />
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.4" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="2.5" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" className="core" />
    </svg>
  );
}
