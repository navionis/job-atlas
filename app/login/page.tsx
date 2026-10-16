export const metadata = { title: "Sign in — Job Atlas" };
import Link from "next/link";
import { Globe, Check } from "lucide-react";
const G = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.03c2.2-2 3.5-5 3.5-8.8"
    />
    <path
      fill="#34A853"
      d="M12 24c3.2 0 5.9-1 7.9-2.8l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2a7.2 7.2 0 0 1-6.8-5l-.14.01-3.6 2.8-.05.13A12 12 0 0 0 12 24"
    />
    <path
      fill="#FBBC05"
      d="M5.2 14.5a7.5 7.5 0 0 1-.4-2.5c0-.9.1-1.7.4-2.5l-.01-.17-3.6-2.8-.12.06A12 12 0 0 0 0 12a12 12 0 0 0 1.1 5l4.1-2.5"
    />
    <path
      fill="#EA4335"
      d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.1 6.7l4.1 3.3A7.2 7.2 0 0 1 12 4.7"
    />
  </svg>
);
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  const { error, mode } = await searchParams;
  const signup = mode === "signup";
  return (
    <main className="login-page">
      <aside className="login-panel">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Globe size={15} strokeWidth={2.2} />
          </span>
          <span>
            job atlas<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="lp-main">
          <h1>
            Work without
            <br />
            borders.
          </h1>
          <p>
            Country-aware job discovery across public and configured feeds. Know where a role actually hires before you
            apply.
          </p>
          <ul>
            <li>
              <Check size={14} />
              250 countries & territories
            </li>
            <li>
              <Check size={14} />
              19 source connectors, one pipeline
            </li>
            <li>
              <Check size={14} />
              Location & eligibility matching
            </li>
            <li>
              <Check size={14} />
              Applied / ignored tracking, synced
            </li>
          </ul>
        </div>
        <div className="lp-stats">
          <div>
            <b>250</b>
            <span>countries</span>
          </div>
          <div>
            <b>19</b>
            <span>source connectors</span>
          </div>
          <div>
            <b>4</b>
            <span>pipeline states</span>
          </div>
        </div>
      </aside>
      <div className="login-side">
        <div className="login-card">
          <div className="login-tabs">
            <a className={signup ? "" : "active"} href="/login">
              Sign in
            </a>
            <a className={signup ? "active" : ""} href="/login?mode=signup">
              Sign up
            </a>
          </div>
          <h2>{signup ? "Create your account" : "Welcome back"}</h2>
          <p>
            {signup
              ? "Sign up with your Google account to start tracking roles."
              : "Sign in with your Google account to continue."}
          </p>
          {error === "denied" ? (
            <div className="alert">This Google account could not be verified.</div>
          ) : error ? (
            <div className="alert">Sign-in failed. Please try again.</div>
          ) : null}
          <a className="google-btn" href="/api/auth/login">
            {G}
            <span>{signup ? "Sign up with Google" : "Continue with Google"}</span>
          </a>
          <small>
            Sign in with any Google account.
            <br />
            More sign-in methods coming later.
          </small>
        </div>
      </div>
    </main>
  );
}
