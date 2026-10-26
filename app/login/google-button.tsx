"use client";
import { useState } from "react";
import { Spinner } from "../../components/loader";

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
export default function GoogleButton({ signup, next }: { signup: boolean; next?: string }) {
  const [loading, setLoading] = useState(false);
  const href = "/api/auth/login" + (next ? `?next=${encodeURIComponent(next)}` : "");
  return (
    <a className={"google-btn" + (loading ? " loading" : "")} href={href} onClick={() => setLoading(true)}>
      {loading ? <Spinner size={17} /> : G}
      <span>{loading ? "Redirecting to Google…" : signup ? "Sign up with Google" : "Continue with Google"}</span>
    </a>
  );
}
