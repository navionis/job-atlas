import { withSession, withUser } from "../../../../lib/guard";
import { getProfile, saveProfile, effectiveKeywords } from "../../../../lib/profiles";
import { snapshot } from "../../../../lib/feeds";
import { rankJobs } from "../../../../lib/match";
import { clientIp, rateLimit } from "../../../../lib/rate-limit";
import {
  buildMatchPrompt,
  createMatchSession,
  devinEnabled,
  getSession,
  parseVerdicts,
  sessionDetail,
  sessionOutcome,
} from "../../../../lib/devin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Jobs sent per run — enough signal for ranking, small enough to keep the
// session prompt (and ACU spend) bounded.
const CANDIDATE_LIMIT = 40;

export const POST = withUser(async (me, request) => {
  if (!devinEnabled())
    return Response.json({ error: "AI matching is not configured on this deployment" }, { status: 503 });
  // ACUs cost money — 3 runs/hour per user, 10/hour per IP.
  if (
    !rateLimit(`agent-match:${me.email}`, 3, 3600000) ||
    !rateLimit(`agent-match-ip:${clientIp(request)}`, 10, 3600000)
  )
    return Response.json({ error: "Match runs are limited — try again later" }, { status: 429 });
  const p = await getProfile(me.email);
  if (p.agentMatch?.status === "running")
    return Response.json({ error: "A match run is already in progress" }, { status: 409 });
  const keywords = effectiveKeywords(p);
  if (!keywords.length)
    return Response.json({ error: "Add resume or manual keywords on your profile first" }, { status: 400 });
  const snap = await snapshot(me.email);
  const ranked = rankJobs(snap.jobs, keywords, p.excluded, p.sourceRank).slice(0, CANDIDATE_LIMIT);
  if (!ranked.length) return Response.json({ error: "No jobs match your keywords right now" }, { status: 400 });
  const session = await createMatchSession(
    buildMatchPrompt(
      { keywords, excluded: p.excluded, filters: p.filters },
      ranked.map((m) => m.job),
    ),
  );
  if (!session?.session_id) return Response.json({ error: "Could not start the agent session" }, { status: 502 });
  p.agentMatch = {
    sessionId: session.session_id,
    url: session.url || "",
    ranAt: Date.now(),
    status: "running",
  };
  await saveProfile(me.email, p);
  return Response.json(p.agentMatch);
});

export const GET = withSession(async (me) => {
  const p = await getProfile(me.email);
  const run = p.agentMatch;
  if (!run) return Response.json({ status: "idle" });
  if (run.status !== "running") return Response.json(run);
  const s = await getSession(run.sessionId);
  if (!s) return Response.json(run); // transient Devin API failure — keep state
  const outcome = sessionOutcome(s);
  if (outcome === "running") return Response.json(run);
  if (outcome === "failed") {
    run.status = "error";
    run.error = `Agent session ended as ${sessionDetail(s)}`;
    await saveProfile(me.email, p);
    return Response.json(run);
  }
  const snap = await snapshot(me.email).catch(() => null);
  const valid = new Set((snap?.jobs || []).map((j) => j.id));
  run.matches = parseVerdicts(s.structured_output, valid);
  run.status = run.matches.length ? "done" : "error";
  if (!run.matches.length) run.error = "Agent returned no usable verdicts";
  await saveProfile(me.email, p);
  return Response.json(run);
});
