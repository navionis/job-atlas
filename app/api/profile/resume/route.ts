import { randomBytes } from "node:crypto";
import { withUser } from "../../../../lib/guard";
import { getProfile, saveProfile, effectiveKeywords, extractKeywords } from "../../../../lib/profiles";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX = 4 * 1024 * 1024;
const MAX_RESUMES = 10;
const view = (p: { keywords: string[]; excluded: string[]; resumes: { text: string; [k: string]: any }[] }) => ({
  keywords: effectiveKeywords(p as any),
  manual: p.keywords,
  excluded: p.excluded,
  resumes: (p.resumes || []).map(({ text, ...r }) => ({ ...r, chars: text.length })),
});
export const POST = withUser(async (me, request) => {
  let f: File | null = null;
  try {
    f = (await request.formData()).get("file") as File | null;
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  if (!f || !f.name) return Response.json({ error: "No file uploaded" }, { status: 400 });
  if (f.size > MAX) return Response.json({ error: "File too large (4 MB max)" }, { status: 413 });
  const p = await getProfile(me.email);
  if ((p.resumes || []).length >= MAX_RESUMES)
    return Response.json({ error: `Maximum ${MAX_RESUMES} resumes — delete one first` }, { status: 400 });
  // Magic-byte check: extensions are trivially lied about, so sniff the real
  // header before handing the bytes to a native-adjacent parser.
  const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04; // PK\x03\x04
  let text = "";
  if (/\.pdf$/i.test(f.name)) {
    if (!isPdf) return Response.json({ error: "That file isn't a real PDF" }, { status: 415 });
    try {
      const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
      text = (await pdfParse(Buffer.from(await f.arrayBuffer()))).text;
    } catch {
      return Response.json({ error: "Could not parse this PDF" }, { status: 422 });
    }
  } else if (/\.docx$/i.test(f.name)) {
    if (!isZip) return Response.json({ error: "That file isn't a real DOCX" }, { status: 415 });
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
  const rec = {
    id: randomBytes(8).toString("hex"),
    name: f.name,
    size: f.size,
    uploadedAt: Date.now(),
    text: text.slice(0, 200000),
    keywords: extractKeywords(text),
  };
  p.resumes.push(rec);
  await saveProfile(me.email, p);
  return Response.json(view(p));
});
export const PATCH = withUser(async (me, request) => {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const alias = String(body.alias ?? "")
    .trim()
    .slice(0, 80);
  const p = await getProfile(me.email);
  const r = (p.resumes || []).find((x) => x.id === id);
  if (!r) return Response.json({ error: "Unknown resume" }, { status: 404 });
  r.alias = alias || undefined;
  await saveProfile(me.email, p);
  return Response.json(view(p));
});
export const DELETE = withUser(async (me, request) => {
  const id = new URL(request.url).searchParams.get("id") || "";
  const p = await getProfile(me.email);
  p.resumes = (p.resumes || []).filter((r) => r.id !== id);
  await saveProfile(me.email, p);
  return Response.json(view(p));
});
