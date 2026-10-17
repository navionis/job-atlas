"use client";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Sonner toaster synced to the app's .dark class on <html>. */
export function AppToaster() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return <Toaster theme={dark ? "dark" : "light"} position="top-right" richColors closeButton />;
}
