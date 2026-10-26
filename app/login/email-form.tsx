"use client";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Spinner } from "../../components/loader";

export default function EmailForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) setState("sent");
      else {
        setState("error");
        setMsg((await r.json()).error || "Could not send right now");
      }
    } catch {
      setState("error");
      setMsg("Could not send right now");
    }
  };
  if (state === "sent")
    return (
      <div className="email-sent">
        Check your inbox — a sign-in link is on its way to <b>{email}</b>. It works once and expires in 10 minutes.
      </div>
    );
  return (
    <form className="email-form" onSubmit={submit}>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" className="google-btn" disabled={state === "sending"}>
        {state === "sending" ? <Spinner size={17} /> : <Mail size={17} />}
        <span>{state === "sending" ? "Sending link…" : "Email me a sign-in link"}</span>
      </button>
      {state === "error" && <div className="alert">{msg}</div>}
    </form>
  );
}
