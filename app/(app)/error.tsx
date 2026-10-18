"use client";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="route-load">
      <TriangleAlert size={30} />
      <b>Something went wrong.</b>
      <p className="pf-hint">The page failed to load. Your data is safe — try again.</p>
      <button className="primary" onClick={reset}>
        Retry
      </button>
      <Link className="ghost" href="/">
        Back to dashboard
      </Link>
    </div>
  );
}
