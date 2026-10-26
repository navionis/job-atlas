import { withSession, withUser } from "../../../../lib/guard";
import { getProfile, saveProfile, effectiveKeywords } from "../../../../lib/profiles";
import { clientIp, rateLimit } from "../../../../lib/rate-limit";
import {
  buildResumePrompt,
  createResumeSession,
  devinEnabled,
  getSession,
  parseKeywords,
  sessionDetail,
  sessionOutcome,
} from "../../../../lib/devin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const view = (p: { resumes?: { text: string; [k: string]: any }[] }) => ({
  keywords: effectiveKeywords(p as any),
  resumes: (p.resumes || []).map(({ text, ...r }) => ({ ...r, chars: text.length })),
});

// POST {resumeId} — start a Devin session that extracts keywords from the
// resume's stored text. Local dictionary keywords already saved at upload stay
// as the fallback until the agent's list lands.
export const POST = withUser(async (me, request) => {
  if (!devinEnabled())
    return Response.json({ error: "AI extraction is not configured on this deployment" }, { status: 503 });
  const { resumeId } = await request.json().catch(() => ({}));
  const p = await getProfile(me.email);
  const resume = (p.resumes || []).find((r) => r.id === resumeId);
  if (!resume) return Response.json({ error: "Unknown resume" }, { status: 404 });
  if (resume.agentRun?.status === "running")
    return Response.json({ error: "Analysis already running" }, { status: 409 });
  if (
    !rateLimit(`agent-resume:${me.email}`, 5, 3600000) ||
    !rateLimit(`agent-resume-ip:${clientIp(request)}`, 15, 3600000)
  )
    return Response.json({ error: "Too many analysis runs — try again later" }, { status: 429 });
  const session = await createResumeSession(buildResumePrompt(resume.name, resume.text));
  if (!session?.session_id) return Response.json({ error: "Could not start the agent session" }, { status: 502 });
  resume.agentRun = { sessionId: session.session_id, url: session.url || "", ranAt: Date.now(), status: "running" };
  await saveProfile(me.email, p);
  return Response.json({ agentRun: resume.agentRun, ...view(p) });
});

// GET ?id= — poll the run; on completion swap in the agent's keywords.
export const GET = withSession(async (me, request) => {
  const id = new URL(request.url).searchParams.get("id") || "";
  const p = await getProfile(me.email);
  const resume = (p.resumes || []).find((r) => r.id === id);
  if (!resume?.agentRun) return Response.json({ status: "idle" });
  const run = resume.agentRun;
  if (run.status !== "running") return Response.json({ agentRun: run, ...view(p) });
  const s = await getSession(run.sessionId);
  if (!s) return Response.json({ agentRun: run, ...view(p) }); // transient — keep state
  const outcome = sessionOutcome(s);
  if (outcome === "running") return Response.json({ agentRun: run, ...view(p) });
  if (outcome === "failed") {
    run.status = "error";
    await saveProfile(me.email, p);
    return Response.json({ agentRun: run, error: `Agent session ended as ${sessionDetail(s)}`, ...view(p) });
  }
  const { keywords, summary } = parseKeywords(s.structured_output);
  if (!keywords.length) {
    run.status = "error";
    await saveProfile(me.email, p);
    return Response.json({ agentRun: run, error: "Agent returned no usable keywords", ...view(p) });
  }
  resume.keywords = keywords;
  resume.aiSummary = summary || undefined;
  run.status = "done";
  await saveProfile(me.email, p);
  return Response.json({ agentRun: run, extracted: keywords, summary, ...view(p) });
});
