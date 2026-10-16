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
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.8" />
      <ellipse cx="12" cy="12" rx="4.6" ry="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
      <line x1="3" y1="8.8" x2="21" y2="8.8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
      <line x1="3" y1="15.2" x2="21" y2="15.2" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="12" cy="2.5" r="2.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" className="core" />
    </svg>
  );
}
