import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { parseScope } from "./geo";
import { catalog } from "./catalog";
import {
  pgEnabled,
  loadState,
  saveState,
  upsertJobs,
  dbSetJobStatus,
  dbDeleteJobStatus,
  dbSetFeedDisabled,
  dbSetAdmin,
} from "./db";
import { listProfileEmails } from "./profiles";
import type { StoreState } from "./db";
import type { Job, JobStatus, Snapshot, SourceStatus } from "./types";
type Row = Record<string, any>;
type Feed = {
  id: string;
  provider: string;
  url: string;
  ttl: number;
  init?: RequestInit;
  html?: boolean;
  pages?: number;
  pageUrl?: (page: number) => { url: string; init?: RequestInit };
  map: (data: any) => Job[];
};
const H = 3600000;
const plain = (v: any) =>
  String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function job(source: string, r: Row): Job {
  const location = plain(r.location),
    elig = plain(r.eligibility);
  const date = new Date(r.posted || "");
  return {
    id: source + ":" + r.id,
    title: plain(r.title),
    company: plain(r.company) || "Employer not specified",
    url: safeUrl(r.url),
    source,
    location: location || "Location not specified",
    remote: !!r.remote,
    posted: isNaN(date.getTime()) ? "" : date.toISOString(),
    tags: (r.tags || []).map(plain),
    scope: parseScope(location),
    eligibility: parseScope(elig),
    summary: plain(r.summary).slice(0, 1200),
  };
}
function safeUrl(v: any) {
  try {
    const u = new URL(v);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
const list = (s: string | undefined) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[a-zA-Z0-9_-]+$/.test(x))
    .slice(0, 20);
const getro = (page: number) => ({
  url: "https://api.getro.com/api/v2/collections/20916/search/jobs",
  init: {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ hits_per_page: 100, page, filters: {} }),
  },
});
function getroJobs(d: any): Job[] {
  return (d.results?.jobs || []).map((j: Row) =>
    job("getro", {
      id: j.id,
      title: j.title,
      company: j.organization?.name,
      url: j.url,
      location: (j.searchable_locations || []).slice(0, 2).join("; "),
      remote: j.work_mode === "remote",
      posted: (j.created_at || 0) * 1000,
      tags: j.skills,
    }),
  );
}
function web3careerJobs(html: string): Job[] {
  const postings: Row[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      if (d["@type"] === "JobPosting") postings.push(d);
    } catch {}
  }
  const rows = [
    ...html.matchAll(
      /<tr[^>]*data-jobid=(\d+)[^>]*onclick="tableTurboRowClick\(event, '([^']+)'\)"[^>]*>([\s\S]*?)<\/tr>/g,
    ),
  ];
  const enrich = postings.length === rows.length;
  return rows.map((m, i) => {
    const [, id, path, row] = m;
    const pick = (re: RegExp) => plain((row.match(re) || [])[1]);
    const p = enrich ? postings[i] : undefined;
    const loc = pick(/job-location-mobile[\s\S]*?<a[^>]*>([^<]*)<\/a>/);
    const salary = pick(/text-salary[^>]*>([\s\S]*?)<\/p>/);
    return job("web3career", {
      id,
      title: pick(/<h2[^>]*>([\s\S]*?)<\/h2>/),
      company: pick(/<h3[^>]*>([\s\S]*?)<\/h3>/),
      url: "https://web3.career" + path,
      location: loc || p?.jobLocation?.address?.addressLocality,
      eligibility: p?.applicantLocationRequirements?.name,
      remote: /remote/i.test(loc) || p?.jobLocationType === "TELECOMMUTE",
      posted: (row.match(/<time datetime="([^"]+)"/) || [])[1] || p?.datePosted,
      tags: [
        p?.employmentType,
        salary,
        ...row.matchAll(/my-badge[^>]*>\s*<a[^>]*>([^<]*)<\/a>/g).map((t: RegExpMatchArray) => plain(t[1])),
      ].filter(Boolean),
      summary: p?.description,
    });
  });
}
function raretalentJobs(html: string): Job[] {
  const out: Job[] = [];
  for (const m of html.replace(/\\"/g, '"').matchAll(/\{"slug":"[^"]+","title":"[^"]+","company":"[^"]*"[^{}]*?\}/g)) {
    try {
      const r = JSON.parse(m[0]);
      out.push(
        job("raretalent", {
          id: r.slug,
          title: r.title,
          company: r.company,
          url: "https://raretalent.xyz/jobs/" + r.slug,
          location: r.location,
          eligibility: r.location,
          remote: r.locationType === "Remote",
          posted: r.formattedDate,
          tags: [r.category, r.type, r.salary, ...(r.tags || [])].filter(Boolean),
          summary: r.description,
        }),
      );
    } catch {}
  }
  return out;
}
function findweb3Jobs(html: string): Job[] {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  const jobs = JSON.parse(m[1]).props?.pageProps?.jobs || [];
  return jobs.map((r: Row) =>
    job("findweb3", {
      id: r._id,
      title: r.jobTitle,
      company: r.companyName,
      url: "https://findweb3.com/job/" + r._id,
      location: r.companyHq,
      remote: /remote/i.test(r.companyHq || ""),
      posted: r.postedDate,
      tags: [r.pay].filter(Boolean),
    }),
  );
}
function sailonchainJobs(html: string): Job[] {
  const out: Job[] = [];
  for (const m of html.matchAll(/<article class="job-card[^"]*"[\s\S]*?<\/article>/g)) {
    const card = m[0];
    const href = (card.match(/class="job-card-title[^"]*"[^>]*href="([^"]+)"/) || [])[1];
    const company = plain((card.match(/class="job-card-company[^>]*>([\s\S]*?)<\/a>/) || [])[1]);
    let title = plain((card.match(/class="job-card-title[^>]*>([\s\S]*?)<\/a>/) || [])[1]);
    if (company && title.endsWith(" - " + company)) title = title.slice(0, -(company.length + 3));
    const loc = plain((card.match(/class="job-card-loc[\s\S]*?<span>([^<]*)<\/span>/) || [])[1]);
    if (!href || !title) continue;
    out.push(
      job("sailonchain", {
        id: href.split("/").pop(),
        title,
        company,
        url: "https://sailonchain.com" + href,
        location: loc,
        eligibility: loc,
        remote: /remote/i.test(loc),
        posted: (card.match(/<time dateTime="([^"]+)"/) || [])[1],
        tags: [
          plain((card.match(/class="job-card-type[^>]*>([\s\S]*?)<\/span>/) || [])[1]),
          plain((card.match(/class="job-card-salary[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1]),
          ...[...card.matchAll(/class="job-card-tag[^>]*>([\s\S]*?)<\/a>/g)].map((t) =>
            plain(t[1]).replace(/^#\s*/, ""),
          ),
        ].filter(Boolean),
      }),
    );
  }
  return out;
}
export function feeds(): Feed[] {
  const out: Feed[] = [
    {
      id: "remotive",
      provider: "remotive",
      url: "https://remotive.com/api/remote-jobs",
      ttl: 6 * H,
      map: (d) =>
        (d.jobs || []).map((r: Row) =>
          job("remotive", {
            id: r.id,
            title: r.title,
            company: r.company_name,
            url: r.url,
            location: r.candidate_required_location,
            eligibility: r.candidate_required_location,
            remote: true,
            posted: r.publication_date,
            tags: [r.category],
            summary: r.description,
          }),
        ),
    },
    {
      id: "remoteok",
      provider: "remoteok",
      url: "https://remoteok.com/api",
      ttl: H,
      map: (d) =>
        (Array.isArray(d) ? d : [])
          .filter((r: Row) => r.id && r.position)
          .map((r: Row) =>
            job("remoteok", {
              id: r.id,
              title: r.position,
              company: r.company,
              url: r.url,
              location: r.location,
              remote: true,
              posted: r.date,
              tags: r.tags,
              summary: r.description,
            }),
          ),
    },
    {
      id: "arbeitnow",
      provider: "arbeitnow",
      url: "https://www.arbeitnow.com/api/job-board-api",
      ttl: H,
      map: (d) =>
        (d.data || []).map((r: Row) =>
          job("arbeitnow", {
            id: r.slug,
            title: r.title,
            company: r.company_name,
            url: r.url,
            location: r.location,
            remote: r.remote,
            posted: r.created_at * 1000,
            tags: r.tags,
            summary: r.description,
          }),
        ),
    },
    {
      id: "cryptocurrencyjobs",
      provider: "cryptocurrencyjobs",
      url: "https://8ehcb38y1u-dsn.algolia.net/1/indexes/jobs/query",
      ttl: 6 * H,
      init: {
        method: "POST",
        headers: {
          "X-Algolia-Application-Id": "8EHCB38Y1U",
          "X-Algolia-API-Key": "e3deada9c15551e6363ee91e7e7d59cc",
          Referer: "https://cryptocurrencyjobs.co/",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "",
          hitsPerPage: 100,
          page: 0,
          filters: "searchFilter:engineering",
          attributesToRetrieve: [
            "objectID",
            "title",
            "company",
            "permalink",
            "datePublished",
            "locationFilter",
            "onsiteLocation",
            "role",
            "employmentTypes",
            "baseSalary",
            "is_ad",
            "description",
          ],
        }),
      },
      map: (d) =>
        (d.hits || [])
          .filter((h: Row) => !h.is_ad)
          .map((h: Row) =>
            job("cryptocurrencyjobs", {
              id: h.objectID,
              title: h.title,
              company: h.company?.name,
              url: "https://cryptocurrencyjobs.co" + h.permalink,
              location: [...new Set([...(h.locationFilter || []), h.onsiteLocation].filter(Boolean))].join("; "),
              eligibility: (h.locationFilter || []).join("; "),
              remote: (h.locationFilter || []).includes("Remote"),
              posted: h.datePublished,
              tags: [h.role?.name, ...(h.employmentTypes || []).map((t: Row) => t.name), h.baseSalary].filter(Boolean),
              summary: h.description,
            }),
          ),
    },
    {
      id: "web3career",
      provider: "web3career",
      url: "https://web3.career/remote-jobs",
      ttl: 6 * H,
      html: true,
      map: web3careerJobs,
    },
    { id: "jumpcrypto", provider: "getro", ...getro(1), ttl: 6 * H, pages: 3, pageUrl: getro, map: getroJobs },
    {
      id: "raretalent",
      provider: "raretalent",
      url: "https://raretalent.xyz/jobs?location=Remote",
      ttl: 6 * H,
      html: true,
      map: raretalentJobs,
    },
    {
      id: "findweb3",
      provider: "findweb3",
      url: "https://findweb3.com/jobs/engineering",
      ttl: 6 * H,
      html: true,
      map: findweb3Jobs,
    },
    {
      id: "sailonchain",
      provider: "sailonchain",
      url: "https://sailonchain.com/jobs/location/remote",
      ttl: 6 * H,
      html: true,
      map: sailonchainJobs,
    },
  ];
  if (process.env.MUSE_API_KEY)
    out.push({
      id: "muse",
      provider: "muse",
      url: "https://www.themuse.com/api/public/jobs?page=0&api_key=" + encodeURIComponent(process.env.MUSE_API_KEY),
      ttl: H,
      map: (d) =>
        (d.results || []).map((r: Row) =>
          job("muse", {
            id: r.id,
            title: r.name,
            company: r.company?.name,
            url: r.refs?.landing_page,
            location: (r.locations || []).map((x: Row) => x.name).join("; "),
            posted: r.publication_date,
            remote: (r.locations || []).some((x: Row) => /remote/i.test(x.name)),
            tags: (r.categories || []).map((x: Row) => x.name),
            summary: r.contents,
          }),
        ),
    });
  for (const slug of list(process.env.GREENHOUSE_BOARDS))
    out.push({
      id: "greenhouse:" + slug,
      provider: "greenhouse",
      url: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
      ttl: H,
      map: (d) =>
        (d.jobs || []).map((r: Row) =>
          job("greenhouse", {
            id: slug + ":" + r.id,
            title: r.title,
            company: slug,
            url: r.absolute_url,
            location: r.location?.name,
            posted: r.updated_at,
            remote: /remote/i.test(r.location?.name || ""),
            summary: r.content,
          }),
        ),
    });
  for (const slug of list(process.env.LEVER_BOARDS))
    out.push({
      id: "lever:" + slug,
      provider: "lever",
      url: `https://api.lever.co/v0/postings/${slug}?mode=json`,
      ttl: H,
      map: (d) =>
        (Array.isArray(d) ? d : []).map((r: Row) =>
          job("lever", {
            id: slug + ":" + r.id,
            title: r.text,
            company: slug,
            url: r.hostedUrl,
            location: r.categories?.location,
            posted: r.createdAt,
            remote: r.workplaceType === "remote",
            tags: [r.categories?.team].filter(Boolean),
            summary: r.descriptionPlain,
          }),
        ),
    });
  for (const slug of list(process.env.ASHBY_BOARDS))
    out.push({
      id: "ashby:" + slug,
      provider: "ashby",
      url: `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
      ttl: H,
      map: (d) =>
        (d.jobs || [])
          .filter((r: Row) => r.isListed !== false)
          .map((r: Row) =>
            job("ashby", {
              id: r.id || r.jobUrl,
              title: r.title,
              company: slug,
              url: r.jobUrl,
              location: [
                r.location,
                r.address?.postalAddress?.addressCountry,
                ...(r.secondaryLocations || []).flatMap((x: Row) => [
                  x.location,
                  x.address?.postalAddress?.addressCountry,
                ]),
              ]
                .filter(Boolean)
                .join("; "),
              posted: r.publishedAt,
              remote: r.isRemote,
              summary: r.descriptionPlain,
            }),
          ),
    });
  for (const slug of list(process.env.SMARTRECRUITERS_BOARDS))
    out.push({
      id: "smartrecruiters:" + slug,
      provider: "smartrecruiters",
      url: `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=0&destination=PUBLIC`,
      ttl: H,
      map: (d) =>
        (d.content || []).map((r: Row) =>
          job("smartrecruiters", {
            id: r.id,
            title: r.name,
            company: r.company?.name || slug,
            url: `https://jobs.smartrecruiters.com/${slug}/${r.id}`,
            location: [r.location?.city, r.location?.country?.toUpperCase()].filter(Boolean).join(", "),
            remote: r.location?.remote,
            posted: r.releasedDate,
          }),
        ),
    });
  const market = (process.env.ADZUNA_COUNTRY || "gb").toLowerCase();
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && /^[a-z]{2}$/.test(market))
    out.push({
      id: "adzuna:" + market,
      provider: "adzuna",
      url:
        `https://api.adzuna.com/v1/api/jobs/${market}/search/1?` +
        new URLSearchParams({
          app_id: process.env.ADZUNA_APP_ID,
          app_key: process.env.ADZUNA_APP_KEY,
          results_per_page: "50",
          what: process.env.FEED_KEYWORDS || "developer",
        }),
      ttl: 6 * H,
      map: (d) =>
        (d.results || []).map((r: Row) =>
          job("adzuna", {
            id: r.id,
            title: r.title,
            company: r.company?.display_name,
            url: r.redirect_url,
            location: (r.location?.area || [r.location?.display_name]).filter(Boolean).join(", "),
            posted: r.created,
            summary: r.description,
          }),
        ),
    });
  if (process.env.JOOBLE_API_KEY && process.env.JOOBLE_ENABLED === "true")
    out.push({
      id: "jooble",
      provider: "jooble",
      url: "https://jooble.org/api/" + encodeURIComponent(process.env.JOOBLE_API_KEY),
      ttl: 24 * H,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: process.env.FEED_KEYWORDS || "developer",
          location: process.env.JOOBLE_LOCATION || "United States",
          page: "1",
        }),
      },
      map: (d) =>
        (d.jobs || []).map((r: Row) =>
          job("jooble", {
            id: r.id,
            title: r.title,
            company: r.company,
            url: r.link,
            location: r.location,
            posted: r.updated,
            summary: r.snippet,
          }),
        ),
    });
  if (process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL)
    out.push({
      id: "usajobs",
      provider: "usajobs",
      url:
        "https://data.usajobs.gov/api/search?ResultsPerPage=100&Keyword=" +
        encodeURIComponent(process.env.FEED_KEYWORDS || "developer"),
      ttl: 6 * H,
      init: { headers: { "User-Agent": process.env.USAJOBS_EMAIL, "Authorization-Key": process.env.USAJOBS_API_KEY } },
      map: (d) =>
        (d.SearchResult?.SearchResultItems || []).map((x: Row) => {
          const r = x.MatchedObjectDescriptor;
          return job("usajobs", {
            id: x.MatchedObjectId,
            title: r.PositionTitle,
            company: r.OrganizationName,
            url: r.PositionURI,
            location: (r.PositionLocation || [])
              .map((l: Row) => [l.LocationName, l.CountryCode].filter(Boolean).join(", "))
              .join("; "),
            posted: r.PublicationStartDate,
            summary: r.QualificationSummary,
          });
        }),
    });
  if (process.env.RELIEFWEB_APPNAME)
    out.push({
      id: "reliefweb",
      provider: "reliefweb",
      url: "https://api.reliefweb.int/v2/jobs?" + new URLSearchParams({ appname: process.env.RELIEFWEB_APPNAME }),
      ttl: 6 * H,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 100,
          sort: ["date.created:desc"],
          fields: { include: ["title", "url", "body", "country.name", "source.name", "date.created"] },
          ...(process.env.RELIEFWEB_COUNTRY
            ? { filter: { field: "country.iso3", value: process.env.RELIEFWEB_COUNTRY.toLowerCase() } }
            : {}),
        }),
      },
      map: (d) =>
        (d.data || []).map((x: Row) => {
          const r = x.fields;
          return job("reliefweb", {
            id: x.id,
            title: r.title,
            company: (r.source || []).map((a: Row) => a.name).join(", "),
            url: r.url,
            location: (r.country || []).map((a: Row) => a.name).join("; "),
            posted: r.date?.created,
            summary: r.body,
          });
        }),
    });
  if (process.env.REED_API_KEY)
    out.push({
      id: "reed",
      provider: "reed",
      url:
        "https://www.reed.co.uk/api/1.0/search?" +
        new URLSearchParams({ keywords: process.env.FEED_KEYWORDS || "developer", resultsToTake: "100" }),
      ttl: 6 * H,
      init: { headers: { Authorization: "Basic " + Buffer.from(process.env.REED_API_KEY + ":").toString("base64") } },
      map: (d) =>
        (d.results || []).map((r: Row) =>
          job("reed", {
            id: r.jobId,
            title: r.jobTitle,
            company: r.employerName,
            url: r.jobUrl,
            location: r.locationName,
            summary: r.jobDescription,
          }),
        ),
    });
  return out;
}
const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
const file = join(dir, "feeds.json");
function load(): StoreState {
  try {
    const d = JSON.parse(readFileSync(file, "utf8"));
    if (!d.entries || !d.attempts || !d.lifetime) throw Error();
    const nested: StoreState["statuses"] = {};
    for (const [k, v] of Object.entries((d.statuses || {}) as Record<string, any>)) {
      if (typeof v === "string" || (v && typeof v.status === "string"))
        (nested["*"] ??= {})[k] = typeof v === "string" ? { status: v, at: 0 } : v;
      else nested[k] = v;
    }
    d.statuses = nested;
    d.disabled = Array.isArray(d.disabled) ? d.disabled.filter((x: any) => typeof x === "string") : [];
    d.admins = Array.isArray(d.admins) ? d.admins.filter((x: any) => typeof x === "string") : [];
    return d;
  } catch (e: any) {
    if (e.code !== "ENOENT") throw new Error("Cannot read feed state; restore it before fetching to preserve quotas.");
    return { entries: {}, attempts: {}, lifetime: {}, statuses: {}, disabled: [], admins: [] };
  }
}
const globalState = globalThis as typeof globalThis & {
  atlas?: { state: StoreState; pending?: Promise<Snapshot>; hydrated?: Promise<void>; pg?: boolean };
};
const shared = (globalState.atlas ??= { state: load() });
shared.hydrated ??= (async () => {
  if (pgEnabled()) {
    const s = await loadState();
    if (s) {
      shared.state = s;
      shared.pg = true;
    } else shared.pg = false;
  } else shared.pg = false;
})();
function statusesFor(email: string) {
  const all = shared.state.statuses;
  return { ...(all["*"] || {}), ...(all[email] || {}) };
}
export async function setJobStatus(email: string, id: string, status: JobStatus) {
  await shared.hydrated;
  const all = shared.state.statuses;
  const mine = (all[email] ??= {});
  if (all["*"]) {
    for (const [k, v] of Object.entries(all["*"])) mine[k] ??= v;
    delete all["*"];
  }
  if (status === "listed") delete mine[id];
  else mine[id] = { status, at: Date.now() };
  if (shared.pg) {
    if (status === "listed") await dbDeleteJobStatus(email, id);
    else await dbSetJobStatus(email, id, status, Date.now());
  } else await save();
}
export async function isAdminUser(email: string): Promise<boolean> {
  await shared.hydrated;
  const em = email.toLowerCase();
  const env = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (env.includes(em)) return true;
  const a = shared.state.admins || [];
  return a.length === 0 || a.includes(em);
}
// First verified Google sign-in claims the admin seat; ADMIN_EMAILS grants extras.
export async function ensureAdmin(email: string) {
  await shared.hydrated;
  const a = (shared.state.admins ??= []);
  if (a.length === 0 && email) {
    a.push(email.toLowerCase());
    if (shared.pg) await dbSetAdmin(email.toLowerCase(), true);
    else await save();
  }
}
export async function setAdmin(email: string, on: boolean) {
  await shared.hydrated;
  const a = (shared.state.admins ??= []);
  const em = email.toLowerCase();
  const i = a.indexOf(em);
  if (on && i < 0) a.push(em);
  if (!on && i >= 0) a.splice(i, 1);
  if (shared.pg) await dbSetAdmin(em, on);
  else await save();
}
export async function listUsers(): Promise<{ email: string; admin: boolean; viaEnv: boolean; marked: number }[]> {
  await shared.hydrated;
  const env = new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
  const emails = new Set<string>([
    ...(shared.state.admins || []),
    ...Object.keys(shared.state.statuses || {}).filter((e) => e !== "*"),
    ...(await listProfileEmails()),
    ...env,
  ]);
  return [...emails].sort().map((email) => ({
    email,
    admin: env.has(email) || (shared.state.admins || []).includes(email),
    viaEnv: env.has(email),
    marked: Object.keys(shared.state.statuses[email] || {}).length,
  }));
}
export async function setSourceDisabled(id: string, disabled: boolean) {
  await shared.hydrated;
  const known = feeds().some((f) => f.id === id);
  if (!known) throw new Error("Unknown source");
  const list = (shared.state.disabled ??= []);
  const i = list.indexOf(id);
  if (disabled && i < 0) list.push(id);
  if (!disabled && i >= 0) list.splice(i, 1);
  baseCache = null;
  if (shared.pg) await dbSetFeedDisabled(id, disabled);
  else await save();
}
async function save() {
  if (shared.pg) await saveState(shared.state);
  else {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file + ".tmp", JSON.stringify(shared.state));
    renameSync(file + ".tmp", file);
  }
}
export function retryDelay(value: string | null, now = Date.now()) {
  if (!value) return 15 * 60000;
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.max(60000, n * 1000)
    : Math.max(60000, (Date.parse(value) || now + 15 * 60000) - now);
}
function reserve(f: Feed) {
  const now = Date.now(),
    scope =
      f.provider +
      ":" +
      createHash("sha256")
        .update(
          f.provider === "jooble"
            ? process.env.JOOBLE_API_KEY || ""
            : f.provider === "adzuna"
              ? process.env.ADZUNA_APP_ID || ""
              : "public",
        )
        .digest("hex")
        .slice(0, 16);
  const a = (shared.state.attempts[scope] || []).filter((t) => now - t < 31 * 24 * H);
  const limits =
    f.provider === "adzuna"
      ? [
          [60000, 25],
          [24 * H, 250],
          [7 * 24 * H, 1000],
          [31 * 24 * H, 2500],
        ]
      : f.provider === "remotive"
        ? [
            [24 * H, 4],
            [60000, 2],
          ]
        : [];
  if (limits.some(([window, max]) => a.filter((t) => now - t < window).length >= max))
    throw Error("Local quota reached; cached results retained");
  if (f.provider === "jooble" && (shared.state.lifetime[scope] || 0) >= 500)
    throw Error("Local Jooble lifetime budget exhausted");
  shared.state.attempts[scope] = [...a, now];
  shared.state.lifetime[scope] = (shared.state.lifetime[scope] || 0) + 1;
}
async function refresh(f: Feed) {
  await shared.hydrated;
  let e = shared.state.entries[f.id];
  if (e && e.next > Date.now()) return;
  e ??= { jobs: [], next: 0, fetched: 0, status: "loading", detail: "" };
  shared.state.entries[f.id] = e;
  e.next = Date.now() + f.ttl;
  try {
    await shared.hydrated;
    reserve(f);
    await save(); // Reserve before network, including failed calls.
    const requests: { url: string; init?: RequestInit }[] = [{ url: f.url, init: f.init }];
    for (let p = 2; p <= (f.pages || 1); p++) requests.push(f.pageUrl!(p));
    const jobs: Job[] = [];
    for (const r of requests) {
      const response = await fetch(r.url, {
        ...r.init,
        headers: { Accept: f.html ? "text/html, */*" : "application/json", ...r.init?.headers },
        signal: AbortSignal.timeout(18000),
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 503)
          e.next = Math.max(e.next, Date.now() + retryDelay(response.headers.get("retry-after")));
        throw Error(`Provider returned HTTP ${response.status}`);
      }
      jobs.push(...f.map(f.html ? await response.text() : await response.json()));
    }
    const found = jobs.filter((j) => j.title && j.url);
    e.jobs = found;
    e.fetched = Date.now();
    e.status = "connected";
    e.detail =
      f.provider === "remotive"
        ? "Provider listings delayed by 24 hours"
        : "Latest configured feed slice; see coverage";
    if (shared.pg) await upsertJobs(found);
  } catch (error) {
    e.status = e.jobs.length ? "stale" : "unavailable";
    e.detail =
      error instanceof Error && /^(Provider returned|Local )/.test(error.message)
        ? error.message
        : "Could not retrieve feed; check server network and source configuration";
  }
  await save();
}
let baseCache: { snap: Snapshot; feedsKey: string } | null = null;
/** Refresh only feeds that are due (TTL elapsed), stalest-first, 3 at a time. */
export async function syncAll(): Promise<{
  refreshed: string[];
  failed: { id: string; error: string }[];
  skipped: number;
  jobs: number;
  took: number;
}> {
  const t0 = Date.now();
  await shared.hydrated;
  const disabled = new Set(shared.state.disabled || []);
  const due = feeds()
    .filter((f) => !disabled.has(f.id))
    .sort((a, b) => (shared.state.entries[a.id]?.next || 0) - (shared.state.entries[b.id]?.next || 0));
  const refreshed: string[] = [];
  const failed: { id: string; error: string }[] = [];
  let skipped = 0;
  for (let i = 0; i < due.length; i += 3) {
    await Promise.all(
      due.slice(i, i + 3).map(async (f) => {
        const e = shared.state.entries[f.id];
        if (e && e.next > Date.now()) {
          skipped++;
          return;
        }
        await refresh(f);
        const after = shared.state.entries[f.id];
        if (after?.status === "connected") refreshed.push(f.id);
        else failed.push({ id: f.id, error: after?.detail || "unknown" });
      }),
    );
  }
  baseCache = null;
  const jobs = new Set(
    feeds()
      .filter((f) => !disabled.has(f.id))
      .flatMap((f) => shared.state.entries[f.id]?.jobs || [])
      .map((j) => j.url),
  ).size;
  return { refreshed, failed, skipped, jobs, took: Date.now() - t0 };
}
async function collect(): Promise<Snapshot> {
  await shared.hydrated;
  const configured = feeds();
  const disabled = new Set(shared.state.disabled || []);
  const enabled = configured.filter((f) => !disabled.has(f.id));
  const feedsKey = configured.map((f) => f.id).join(",") + "|" + [...disabled].sort().join(",");
  // Reuse the assembled snapshot when no feed is due — refresh() is a no-op
  // until its TTL elapses, so jobs/sources cannot change between those points.
  const due = enabled.some((f) => {
    const e = shared.state.entries[f.id];
    return !e || e.next <= Date.now();
  });
  if (!due && baseCache && baseCache.feedsKey === feedsKey) return baseCache.snap;
  // Three concurrent upstream requests; no per-viewer polling amplification.
  for (let i = 0; i < enabled.length; i += 3) await Promise.all(enabled.slice(i, i + 3).map(refresh));
  const sources: SourceStatus[] = configured.map((f) => {
    const e = shared.state.entries[f.id];
    if (disabled.has(f.id))
      return {
        id: f.id,
        name: catalog.find((c) => c.id === f.provider)!.name + (f.id.includes(":") ? " · " + f.id.split(":")[1] : ""),
        status: "disabled",
        count: e?.jobs.length || 0,
        fetchedAt: e?.fetched || 0,
        nextFetch: 0,
        detail: "Disabled — not fetching; cached listings hidden",
      };
    return {
      id: f.id,
      name: catalog.find((c) => c.id === f.provider)!.name + (f.id.includes(":") ? " · " + f.id.split(":")[1] : ""),
      status: e.status,
      count: e.jobs.length,
      fetchedAt: e.fetched,
      nextFetch: e.next,
      detail: e.detail,
    };
  });
  for (const c of catalog.filter((c) => c.implemented && !configured.some((f) => f.provider === c.id)))
    sources.push({
      id: c.id,
      name: c.name,
      status: "not configured",
      count: 0,
      fetchedAt: 0,
      nextFetch: 0,
      detail: "Add credentials or board slugs in .env.local",
    });
  const seen = new Set<string>();
  const jobs = enabled
    .flatMap((f) => shared.state.entries[f.id]?.jobs || [])
    .filter((j) => {
      const k = j.url.split("?")[0];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.posted.localeCompare(a.posted));
  const snap = { jobs, sources, statuses: {}, updatedAt: Math.max(0, ...sources.map((s) => s.fetchedAt)) };
  baseCache = { snap, feedsKey };
  return snap;
}
export async function snapshot(email = ""): Promise<Snapshot> {
  if (!shared.pending)
    shared.pending = collect().finally(() => {
      shared.pending = undefined;
    });
  const base = await shared.pending;
  return { ...base, statuses: statusesFor(email) };
}
