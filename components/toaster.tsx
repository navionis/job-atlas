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
  return (
    <Toaster
      theme={dark ? "dark" : "light"}
      position="top-right"
      closeButton
      gap={10}
      toastOptions={{
        classNames: {
          toast: "atlas-toast",
          title: "atlas-toast-title",
          description: "atlas-toast-desc",
          actionButton: "atlas-toast-action",
          closeButton: "atlas-toast-close",
          error: "atlas-toast-error",
          success: "atlas-toast-success",
          warning: "atlas-toast-warning",
        },
      }}
    />
  );
}
