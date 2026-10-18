"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Sun, Moon, ArrowUp, LayoutDashboard, Compass, Rss, UserRound, ShieldCheck } from "lucide-react";
import { AtlasMark } from "./atlas-mark";
import { useSnapshot } from "../lib/live";
import { EASE } from "./motion";
import type { Session } from "../lib/auth";

const LINKS: [string, string][] = [
  ["/", "Dashboard"],
  ["/jobs", "Discover jobs"],
  ["/sources", "Sources"],
  ["/profile", "Profile"],
];

const MNAV = [
  { href: "/", label: "Home", Icon: LayoutDashboard },
  { href: "/jobs", label: "Discover", Icon: Compass },
  { href: "/sources", label: "Sources", Icon: Rss },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

export function SiteHeader({ me, admin = false }: { me: Session; admin?: boolean }) {
  const pathname = usePathname();
  const { connection } = useSnapshot();
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        setDark(localStorage.getItem("atlas-theme") === "dark");
      } catch {}
    });
    let tick = false;
    const onScroll = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Hysteresis: shrinking the header shortens the document, which would
        // drop scrollY back under the threshold and oscillate forever.
        const next = scrolledRef.current ? y > 6 : y > 40;
        if (next !== scrolledRef.current) {
          scrolledRef.current = next;
          setScrolled(next);
        }
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
      cancelAnimationFrame(raf);
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
          <AtlasMark size={16} />
        </span>
        <span>
          job atlas<span className="brand-dot">.</span>
        </span>
      </Link>
      <nav>
        {[...LINKS, ...(admin ? [["/admin", "Admin"] as [string, string]] : [])].map(([href, label]) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={active ? "active" : ""}>
              {label}
              {active && (
                <motion.span layoutId="nav-ink" className="nav-ink" transition={{ duration: 0.32, ease: EASE }} />
              )}
            </Link>
          );
        })}
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
                {admin && (
                  <Link href="/admin" onClick={() => setMenu(false)}>
                    Admin
                  </Link>
                )}
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
      <div className="mnav" role="navigation" aria-label="Primary">
        {[...MNAV, ...(admin ? [{ href: "/admin", label: "Admin", Icon: ShieldCheck }] : [])].map(
          ({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} className={active ? "on" : ""} aria-current={active ? "page" : undefined}>
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          },
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="foot-inner">
        <div className="foot-brand">
          <Link href="/" className="foot-logo">
            <span className="brand-mark">
              <AtlasMark size={13} />
            </span>
            job atlas.
          </Link>
          <small>Find work. Know the boundaries.</small>
        </div>
        <div className="foot-links">
          <Link href="/">Dashboard</Link>
          <Link href="/jobs">Discover jobs</Link>
          <Link href="/jobs">Matched for you</Link>
          <Link href="/sources">Sources</Link>
          <Link href="/profile">Profile</Link>
        </div>
        <div className="foot-note">
          <span>Source-linked · No fabricated listings</span>
          <span>REST + SSE live updates</span>
        </div>
      </div>
    </footer>
  );
}

export function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const region = document.querySelector<HTMLElement>(".scroll-region");
    let tick = false;
    const onScroll = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        setShow((region?.scrollTop || window.scrollY) > 600);
        tick = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    region?.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      region?.removeEventListener("scroll", onScroll);
    };
  }, []);
  if (!show) return null;
  return (
    <button
      className="to-top"
      onClick={() => {
        const region = document.querySelector<HTMLElement>(".scroll-region");
        if (region && region.scrollTop > 0) region.scrollTo({ top: 0, behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      aria-label="Back to top"
    >
      <ArrowUp size={16} />
    </button>
  );
}
