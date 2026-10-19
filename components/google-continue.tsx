"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

declare global {
  interface Window {
    __atlasOnetap?: boolean;
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

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

// The One Tap iframe renders inside #credential_picker_container — watching
// for it (rather than the deprecated prompt status methods) tells us whether
// the native prompt actually displayed.
const ONE_TAP_SEL = "#credential_picker_container, iframe[src*='accounts.google.com']";

export default function GoogleContinue({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    // Card is a fallback surface: it only appears when Google's One Tap can't
    // display — never alongside it.
    const showCard = () => {
      if (sessionStorage.getItem("atlas_cta_dismissed")) return;
      sessionStorage.setItem("atlas_cta_show", "1");
      setHidden(false);
    };
    if (sessionStorage.getItem("atlas_cta_show") === "1") {
      const show = requestAnimationFrame(showCard);
      return () => cancelAnimationFrame(show);
    }
    let onetapSeen = !!document.querySelector(ONE_TAP_SEL);
    const observer = new MutationObserver(() => {
      if (!onetapSeen && document.querySelector(ONE_TAP_SEL)) {
        onetapSeen = true;
        setHidden(true); // One Tap is up — the card stays/returns to hidden
      } else if (onetapSeen && !document.querySelector(ONE_TAP_SEL)) {
        onetapSeen = false;
        showCard(); // One Tap dismissed/removed — surface the fallback path
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const fallback = setTimeout(() => {
      if (!onetapSeen) showCard();
    }, 5000);
    if (!clientId || window.__atlasOnetap || sessionStorage.getItem("atlas_cta_dismissed"))
      return () => {
        observer.disconnect();
        clearTimeout(fallback);
      };
    // Window-level flag: survives React StrictMode remounts and Turbopack
    // Fast Refresh, so initialize()+prompt() fire once per page load — repeat
    // calls abort the pending credential request and log spurious errors.
    window.__atlasOnetap = true;
    // Google's GIS client logs "[GSI_LOGGER] …" via console.error/warn for
    // benign cancellations (FedCM aborts, cooldowns, unregistered origin).
    // Not catchable from our side — filter that prefix only.
    for (const k of ["error", "warn"] as const) {
      const orig = console[k].bind(console);
      console[k] = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].startsWith("[GSI_LOGGER]")) return;
        orig(...args);
      };
    }
    const init = () => {
      try {
        window.google?.accounts?.id?.initialize({
          client_id: clientId,
          use_fedcm_for_prompt: false,
          callback: (res: { credential?: string }) => {
            if (!res?.credential) return;
            void fetch("/api/auth/onetap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: res.credential }),
            })
              .then((r) => {
                if (r.ok) window.location.reload();
              })
              .catch(() => {});
          },
        });
        window.google?.accounts?.id?.prompt();
      } catch {
        showCard();
      }
    };
    if (window.google?.accounts?.id) init();
    else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = init;
      s.onerror = showCard;
      document.head.appendChild(s);
    }
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [clientId]);
  if (hidden || !clientId) return null;
  const next = encodeURIComponent(pathname || "/");
  return (
    <aside className="g-continue" role="complementary" aria-label="Sign in suggestion">
      <button
        type="button"
        className="g-continue-close"
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem("atlas_cta_dismissed", "1");
          setHidden(true);
        }}
      >
        <X size={13} />
      </button>
      <div className="g-continue-text">
        <b>You&apos;re browsing as a guest</b>
        <span>Sign in to track jobs, sync your resume and get matches.</span>
      </div>
      <a className="g-continue-btn" href={`/api/auth/login?next=${next}`}>
        {G} Continue with Google
      </a>
    </aside>
  );
}
