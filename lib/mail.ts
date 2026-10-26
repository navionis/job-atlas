import nodemailer from "nodemailer";
import { TOKEN_TTL } from "./email-tokens";

/** SMTP transport from env. SMTP_HOST unset → dev mode (link is logged, not sent). */
const configured = () => !!process.env.SMTP_HOST;
const transporter = () =>
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
  if (!configured()) {
    console.log(`[mail] sign-in link for ${email}: ${url}`);
    return { delivered: false };
  }
  await transporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html,
  });
  return { delivered: true };
}
