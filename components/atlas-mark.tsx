export function AtlasMark({
  size = 16,
  color = "currentColor",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="19" stroke={color} strokeOpacity="0.95" strokeWidth="4.5" />
      <ellipse cx="32" cy="32" rx="8.5" ry="19" stroke={color} strokeOpacity="0.95" strokeWidth="4.5" />
      <path d="M13.3 31 Q32 38 50.7 31" stroke={color} strokeOpacity="0.95" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="28" stroke={color} strokeOpacity="0.45" strokeWidth="2" strokeDasharray="2 6" />
      <path
        d="M59.7 28.1 A30.2 30.2 0 0 0 54.4 11.8 L51.2 14.7 A25.8 25.8 0 0 1 59.7 28.1 Z"
        fill={color}
        fillOpacity="0.8"
      />
      <circle cx="51.8" cy="12.2" r="7" fill={color} fillOpacity="0.2" />
      <circle cx="51.8" cy="12.2" r="4.2" fill={color} />
    </svg>
  );
}
