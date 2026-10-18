import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="route-load">
      <Compass size={30} />
      <b>404 — off the map.</b>
      <p className="pf-hint">This route doesn&apos;t exist on the atlas.</p>
      <Link className="primary" href="/">
        Back to dashboard
      </Link>
    </div>
  );
}
