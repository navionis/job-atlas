const BASE = (process.env.DEVIN_API_URL || "https://api.devin.ai").replace(/\/+$/, "");
export function devinEnabled() {
  return !!process.env.DEVIN_API_KEY;
}
async function createSession(prompt: string, title: string): Promise<string> {
  const key = process.env.DEVIN_API_KEY || "",
    org = process.env.DEVIN_ORG_ID || "";
  const url = org ? `${BASE}/v3/organizations/${org}/sessions` : `${BASE}/v1/sessions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      title,
      structured_output_schema: {
        type: "object",
        properties: {
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Job-search keywords extracted from the resume",
          },
        },
        required: ["keywords"],
      },
    }),
  });
  if (!res.ok) throw Error(`Devin API responded ${res.status}`);
  const d = await res.json();
  const id = d.session_id || d.sessionId;
  if (!id) throw Error("Devin session did not return an id");
  return id;
}
async function waitForKeywords(id: string): Promise<string[]> {
  const key = process.env.DEVIN_API_KEY || "",
    org = process.env.DEVIN_ORG_ID || "";
  const url = org ? `${BASE}/v3/organizations/${org}/sessions/${id}` : `${BASE}/v1/sessions/${id}`;
  const deadline = Date.now() + 4 * 60000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) break;
    const d = await res.json();
    const done = ["finished", "blocked", "expired", "suspend_requested", "resumed"].includes(
      String(d.status_enum || d.status || ""),
    );
    if (!done) continue;
    const out = d.structured_output || d.structuredOutput || {};
    const kws = out.keywords;
    if (!Array.isArray(kws)) return [];
    return [...new Set(kws.map((k) => String(k).toLowerCase().trim()).filter((k) => k.length > 1 && k.length < 60))];
  }
  return [];
}
export async function extractKeywordsWithDevin(text: string, fileName: string): Promise<string[]> {
  if (!devinEnabled()) return [];
  const prompt = [
    "You are a resume keyword extractor for a job-matching system.",
    "Read the resume text below and return up to 80 searchable keywords: skills, technologies, frameworks, tools,",
    "job titles/roles, domains, certifications, languages, methodologies, and notable employers or industries.",
    "Rules: lowercase, no duplicates, single words or short phrases only, only terms relevant to job search.",
    'Return them in the structured output "keywords" array.',
    "",
    `Resume (${fileName}):`,
    text.slice(0, 30000),
  ].join("\n");
  const id = await createSession(prompt, `Resume keywords · ${fileName}`);
  return waitForKeywords(id);
}
