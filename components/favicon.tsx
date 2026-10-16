"use client";
import { useState } from "react";
import { Globe } from "lucide-react";

export function Favicon({ source, size = 14 }: { source: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <Globe size={size} className="favicon-fb" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="favicon"
      src={`/favicons/${source.split(":")[0]}.png`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={() => setErr(true)}
    />
  );
}
