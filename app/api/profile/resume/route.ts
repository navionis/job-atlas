import { randomBytes } from "node:crypto";
import { getSession } from "../../../../lib/auth";
import { getProfile, saveProfile, effectiveKeywords, extractKeywords } from "../../../../lib/profiles";
import { devinEnabled, extractKeywordsWithDevin } from "../../../../lib/devin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;
const view = (p: { keywords: string[]; excluded: string[]; resumes: { text: string; [k: string]: any }[] }) => ({
  keywords: effectiveKeywords(p as any),
  manual: p.keywords,
  excluded: p.excluded,
  resumes: (p.resumes || []).map(({ text, ...r }) => ({ ...r, chars: text.length })),
});
export async function POST(request: Request) {
  const me = getSession(request);
  if (!me) return Response.json({ error: "Sign in required" }, { status: 401 });
  let f: File | null = null;
  try {
    f = (await request.formData()).get("file") as File | null;
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  if (!f || !f.name) return Response.json({ error: "No file uploaded" }, { status: 400 });
  if (f.size > MAX) return Response.json({ error: "File too large (4 MB max)" }, { status: 413 });
  let text = "";
  if (/\.pdf$/i.test(f.name)) {
    try {
      const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
      text = (await pdfParse(Buffer.from(await f.arrayBuffer()))).text;
    } catch {
      return Response.json({ error: "Could not parse this PDF" }, { status: 422 });
    }
  } else if (/\.docx$/i.test(f.name)) {
    try {
      const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
      text = (await mammoth.extractRawText({ buffer: Buffer.from(await f.arrayBuffer()) })).value;
    } catch {
      return Response.json({ error: "Could not parse this DOCX" }, { status: 422 });
    }
  } else if (/\.(txt|md|text)$/i.test(f.name)) text = await f.text();
  else return Response.json({ error: "Unsupported file type — upload a PDF, DOCX, or .txt/.md file" }, { status: 415 });
  text = text.replace(/\s+/g, " ").trim();
  if (text.length < 50) return Response.json({ error: "No readable text found in the file" }, { status: 422 });
  const p = await getProfile(me.email);
  const rec = {
    id: randomBytes(8).toString("hex"),
    name: f.name,
    size: f.size,
    uploadedAt: Date.now(),
    text: text.slice(0, 200000),
    keywords: extractKeywords(text),
    enriched: !devinEnabled(),
  };
  p.resumes.push(rec);
  await saveProfile(me.email, p);
  if (!rec.enriched) void enrich(me.email, rec.id, rec.name, text);
  return Response.json(view(p));
}
async function enrich(email: string, id: string, name: string, text: string) {
  let kws: string[] = [];
  try {
    kws = await extractKeywordsWithDevin(text, name);
  } catch {}
  try {
    const p = await getProfile(email);
    const r = (p.resumes || []).find((x) => x.id === id);
    if (!r) return;
    if (kws.length) r.keywords = [...new Set([...r.keywords, ...kws])].slice(0, 80);
    r.enriched = true;
    await saveProfile(email, p);
  } catch {}
}
export async function DELETE(request: Request) {
  const me = getSession(request);
  if (!me) return Response.json({ error: "Sign in required" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const p = await getProfile(me.email);
  p.resumes = (p.resumes || []).filter((r) => r.id !== id);
  await saveProfile(me.email, p);
  return Response.json(view(p));
}
