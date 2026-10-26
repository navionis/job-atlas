import nodemailer from "nodemailer";
import { TOKEN_TTL } from "./email-tokens";

/** "Name <a@b.c>" or bare address → { email, name? } for providers that split them. */
const sender = (from: string) => {
  const m = from.match(/^(.*)<([^>]+)>/);
  return m ? { email: m[2].trim(), name: m[1].trim() } : { email: from.trim() };
};

/** Transport order: Brevo HTTPS API → SMTP → dev console (links logged). */
const smtp = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

export async function sendMagicLink(email: string, url: string) {
  const mins = Math.round(TOKEN_TTL / 60000);
  const subject = "Sign in to Job Atlas";
  const text = `Sign in to Job Atlas\n\n${url}\n\nThis link expires in ${mins} minutes and can be used once. If you didn't request it, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 12px">Sign in to <b>job atlas<span style="color:#3b82f6">.</span></b></h2>
  <p style="color:#555;margin:0 0 20px">Click below to continue — the link expires in ${mins} minutes and works once.</p>
  <a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">Sign in</a>
  <p style="color:#999;font-size:12px;margin:20px 0 0">If you didn't request this, you can ignore this email.<br>${url}</p>
</div>`;
  const brevo = process.env.BREVO_API_KEY;
  if (brevo) {
    const from = sender(process.env.MAIL_FROM || "");
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevo, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: from.email, name: from.name || "Job Atlas" },
        to: [{ email }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
    if (!r.ok) throw new Error(`brevo ${r.status}: ${await r.text()}`);
    return { delivered: true };
  }
  if (process.env.SMTP_HOST) {
    await smtp().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: email, subject, text, html });
    return { delivered: true };
  }
  console.log(`[mail] sign-in link for ${email}: ${url}`);
  return { delivered: false };
}
