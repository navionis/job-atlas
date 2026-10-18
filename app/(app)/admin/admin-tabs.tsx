"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, Users } from "lucide-react";

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="m-tabs">
      <Link className={"m-tab" + (pathname.startsWith("/admin/users") ? "" : " on")} href="/admin/sources">
        <Rss size={13} /> Sources
      </Link>
      <Link className={"m-tab" + (pathname.startsWith("/admin/users") ? " on" : "")} href="/admin/users">
        <Users size={13} /> Users
      </Link>
    </div>
  );
}
