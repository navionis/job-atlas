export const metadata = {
  title: "Sign in",
  description:
    "Sign in to Job Atlas — country-aware job discovery with resume matching, geo-eligibility filters, and a personal application pipeline.",
  alternates: { canonical: "/login" },
};
import Link from "next/link";
import { Check } from "lucide-react";
import { AtlasMark } from "../../components/atlas-mark";
import GoogleButton from "./google-button";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  const { error, mode } = await searchParams;
  const signup = mode === "signup";
  return (
    <main className="login-page">
      <aside className="login-panel">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <AtlasMark size={16} />
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
            <Link className={signup ? "" : "active"} href="/login">
              Sign in
            </Link>
            <Link className={signup ? "active" : ""} href="/login?mode=signup">
              Sign up
            </Link>
          </div>
          <h2>{signup ? "Create your account" : "Welcome back"}</h2>
          <p>
            {signup
              ? "Sign up with your Google account to start tracking roles."
              : "Sign in with your Google account to continue."}
          </p>
          {error === "denied" ? (
            <div className="alert">This Google account could not be verified.</div>
          ) : error === "config" ? (
            <div className="alert">Sign-in is temporarily unavailable. Please try again later.</div>
          ) : error ? (
            <div className="alert">Sign-in failed. Please try again.</div>
          ) : null}
          <GoogleButton signup={signup} />
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
