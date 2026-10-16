"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Sun, Moon, ArrowUp } from "lucide-react";
import { useSnapshot } from "../lib/live";
import type { Session } from "../lib/auth";

const LINKS: [string, string][] = [
  ["/", "Dashboard"],
  ["/jobs", "Discover jobs"],
  ["/sources", "Sources & limits"],
  ["/profile", "Profile"],
];

export function SiteHeader({ me }: { me: Session }) {
  const pathname = usePathname();
  const { connection } = useSnapshot();
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      setDark(localStorage.getItem("atlas-theme") === "dark");
    } catch {}
    let tick = false;
    const onScroll = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        tick = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const toggleTheme = () =>
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("atlas-theme", next ? "dark" : "light");
      } catch {}
      return next;
    });
  return (
    <header className={scrolled ? "scrolled" : ""}>
      <Link className="brand" href="/">
        <span className="brand-mark">
          <Globe size={15} strokeWidth={2.2} />
        </span>
        <span>
          job atlas<span className="brand-dot">.</span>
        </span>
      </Link>
      <nav>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={pathname === href ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>
      <span className="live">
        <i />
        <span className="conn">{connection}</span>
        {me.email ? (
          <div className="profile" ref={menuRef}>
            <button className="avatar" onClick={() => setMenu((m) => !m)} aria-label="Account" aria-expanded={menu}>
              {me.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{(me.name || me.email || "?").slice(0, 2).toUpperCase()}</span>
              )}
            </button>
            {menu && (
              <div className="profile-menu">
                <b>{me.name || me.email}</b>
                <small>{me.email}</small>
                <Link href="/profile" onClick={() => setMenu(false)}>
                  Profile
                </Link>
                <a href="/api/auth/logout">Sign out</a>
              </div>
            )}
          </div>
        ) : (
          <a className="signout" href="/api/auth/logout">
            Sign out
          </a>
        )}
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle dark mode">
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </span>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <span>
        job atlas. <small>Find work. Know the boundaries.</small>
      </span>
      <div className="foot-links">
        <Link href="/jobs">Discover jobs</Link>
        <Link href="/">Dashboard</Link>
        <Link href="/sources">Sources & limits</Link>
      </div>
      <span>Source-linked · No fabricated listings · REST + SSE</span>
    </footer>
  );
}

export function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let tick = false;
    const onScroll = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        setShow(window.scrollY > 600);
        tick = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
      <ArrowUp size={16} />
    </button>
  );
}
