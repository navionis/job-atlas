import { createHash } from "node:crypto";
import { parseScope } from "./geo";
import type { Job } from "./types";
export type Row = Record<string, any>;
export type Feed = {
  id: string;
  provider: string;
  url: string;
  ttl: number;
  init?: RequestInit;
  html?: boolean;
  pages?: number;
  pageUrl?: (page: number) => { url: string; init?: RequestInit };
  map: (data: any) => Job[];
  // Secondary source used when the primary request fails (e.g. CDN bot
  // checks blocking hnhiring.com — the HN API carries the same thread).
  fallback?: () => Promise<Job[]>;
};
export const H = 3600000;
// Some providers (hnhiring, boards behind bot filters) intermittently 403 the
// default undici `node` UA; a plain browser UA is accepted everywhere.
export const FEED_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
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
    // ~400 chars keeps match scoring + schedule detection intact while cutting
    // the heaviest field out of every serialized snapshot/page payload.
    summary: plain(r.summary).slice(0, 400),
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
// Getro powers both getro.com's collections and network boards like
// jobs.solana.com — same response shape, different collection id.
// A board Referer/Origin keeps the WAF's POST scrutiny low.
const getro =
  (collection: number, board = "https://jobs.jumpcrypto.com") =>
  (page: number) => ({
    url: `https://api.getro.com/api/v2/collections/${collection}/search/jobs`,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: board,
        Referer: board + "/",
      },
      body: JSON.stringify({ hits_per_page: 100, page, filters: {} }),
    },
  });
const getroJobs =
  (source: string) =>
  (d: any): Job[] => {
    return (d.results?.jobs || []).map((j: Row) =>
      job(source, {
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
  };
// A Getro-backed feed entry: first page inline + the paged request factory.
const getroFeed = (id: string, collection: number, board?: string): Feed => {
  const g = getro(collection, board);
  return { id, provider: id, ...g(1), ttl: 6 * H, pages: 3, pageUrl: g, map: getroJobs(id) };
};
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
    const loc = plain(
      ((row.match(/job-location-mobile[^>]*>([\s\S]*?)<\/td>/) || [])[1] || "").replace(
        /<span class=job-loc-pin>[\s\S]*?<\/span>/,
        "",
      ),
    );
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
// Feeds double-escape text nodes ("&amp;amp;") — decode twice so "&" survives.
const decodeEntities = (s: string) => {
  for (let i = 0; i < 2; i++)
    s = s
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      .replace(
        /&(quot|amp|lt|gt|apos);/g,
        (m) => ({ "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&apos;": "'" })[m] || m,
      );
  return s;
};
// Minimal RSS item reader — description/creator/location cover every feed we map.
function rssItems(xml: string): Row[] {
  const items: Row[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const pick = (tag: string) =>
      decodeEntities(
        ((m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || "").replace(
          /<!\[CDATA\[|\]\]>/g,
          "",
        ),
      );
    items.push({
      title: pick("title"),
      link: pick("link"),
      guid: pick("guid"),
      pubDate: pick("pubDate"),
      description: pick("description"),
      category: pick("category"),
      creator: pick("dc:creator"),
      location: pick("media:location"),
    });
  }
  return items;
}
// cryptojobslist.com sits behind a Cloudflare challenge for server fetches,
// but its public RSS carries the same latest ~100 listings — company via
// dc:creator, location via media:location, skills in the "Tags:" anchors.
function cryptojobslistJobs(xml: string): Job[] {
  return rssItems(xml).map((r) => {
    const link = plain(r.link).split("?")[0];
    // The Tags block ends at the next paragraph — it has no closing </p>.
    const tagHtml = (r.description.match(/<p>Tags:([\s\S]*?)(?=<p>)/) || [])[1] || "";
    const tags = [
      ...new Set(
        [...tagHtml.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)]
          .map((m) =>
            plain(m[1])
              .replace(/\s+Jobs$/, "")
              .replace(/^(Web3|Blockchain|Cryptocurrency|Crypto|Bitcoin)\s+/, ""),
          )
          .filter((t) => t && !/^(senior|full time|part time)$/i.test(t)),
      ),
    ].slice(0, 6);
    const summary = r.description
      .replace(/<img[^>]*>/g, "")
      .replace(/<p>Tags:[\s\S]*?<\/p>/, "")
      .replace(/<strong>Apply here[\s\S]*$/, "");
    const location = plain(r.location);
    return job("cryptojobslist", {
      id: (plain(r.guid) || link).split("/").pop(),
      title: r.title,
      company: r.creator,
      url: link,
      location,
      remote: /remote|worldwide|anywhere/i.test(location),
      summary,
      tags,
    });
  });
}
// RSS titles are "Job Application for {role} at {company} at {company}" — the
// description "at {company} - {type} - {location}" carries the clean fields.
function remote3Jobs(xml: string): Job[] {
  return rssItems(xml).map((r) => {
    const [, company = "", type = "", location = ""] = plain(r.description).match(/^at (.*?) - (.*?) - (.*)$/) || [];
    const title = plain(r.title)
      .replace(/^Job Application for /, "")
      .replace(new RegExp(" at " + company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
    return job("remote3", {
      id: (plain(r.guid) || plain(r.link)).split("/").pop(),
      title,
      company,
      url: plain(r.link).split("?")[0],
      location,
      remote: /remote|worldwide/i.test(location),
      posted: r.pubDate,
      tags: [type].filter(Boolean),
    });
  });
}
// crypto.jobs RSS packs Company/Location/Salary/Type/Skills as <strong> rows
// inside the description CDATA; remaining paragraphs are the summary.
function cryptojobsFeedJobs(xml: string): Job[] {
  return rssItems(xml).map((r) => {
    const d = r.description || "";
    const field = (k: string) => plain((d.match(new RegExp(`<strong>${k}:</strong>\\s*([\\s\\S]*?)</p>`)) || [])[1]);
    const title = plain(r.title);
    const company = field("Company") || plain((title.match(/ at (.*)$/) || [])[1]);
    return job("cryptojobs", {
      id: (plain(r.guid) || plain(r.link)).split("/").pop(),
      title: company && title.endsWith(" at " + company) ? title.slice(0, -(company.length + 4)) : title,
      company,
      url: plain(r.link).split("?")[0],
      location: field("Location"),
      remote: /remote/i.test(field("Location")),
      posted: r.pubDate,
      tags: [plain(r.category), field("Type"), field("Salary"), ...field("Skills").split(/,\s*/)]
        .filter(Boolean)
        .slice(0, 8),
      summary: d.replace(/<p>\s*<strong>(Company|Location|Salary|Type|Skills):<\/strong>[\s\S]*?<\/p>/g, ""),
    });
  });
}
// Card ages render relatively ("1h", "3d") — convert to a timestamp at parse.
const AGE_UNITS: Record<string, number> = {
  m: 60000,
  h: H,
  d: 24 * H,
  w: 7 * 24 * H,
  mo: 30 * 24 * H,
  y: 365 * 24 * H,
};
function jobsweb3Jobs(html: string): Job[] {
  const out: Job[] = [];
  for (const m of html.matchAll(/<li class="job" data-key="([^"]+)"[\s\S]*?<\/li>/g)) {
    const card = m[0];
    const a = card.match(/job__link" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const loc = plain((card.match(/job__loc">([\s\S]*?)<\/span>/) || [])[1]);
    const age = plain((card.match(/job__age">([\s\S]*?)<\/span>\s*<\/span>/) || [])[1]);
    const t = age.match(/(\d+)\s*([a-z]+)/i);
    out.push(
      job("jobsweb3", {
        id: m[1],
        title: a[2],
        company: (card.match(/job__name">([^<]*)</) || [])[1],
        url: "https://jobsweb3.io" + a[1],
        location: loc,
        eligibility: loc,
        remote: /remote/i.test(loc),
        posted: t ? new Date(Date.now() - Number(t[1]) * (AGE_UNITS[t[2].toLowerCase()] || H)).toISOString() : "",
        tags: [plain((card.match(/job__pay">([\s\S]*?)<\/span>/) || [])[1])].filter(Boolean),
      }),
    );
  }
  return out;
}
// Curated <table>s — two layouts share the page: company|title|type|location
// and an external-offers one prefixed by a source-name link cell. The last
// non-social external href in a row is the apply URL. Dates are French and
// sometimes yearless.
const FR_MONTHS: Record<string, string> = {
  janv: "Jan",
  févr: "Feb",
  mars: "Mar",
  avr: "Apr",
  mai: "May",
  juin: "Jun",
  juil: "Jul",
  août: "Aug",
  sept: "Sep",
  oct: "Oct",
  nov: "Nov",
  déc: "Dec",
  dec: "Dec",
};
const frMonth = (w: string) =>
  Object.entries(FR_MONTHS).find(([k]) => w.startsWith(k))?.[1] || w[0].toUpperCase() + w.slice(1, 3);
function coinacademyJobs(html: string): Job[] {
  const out: Job[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 6) continue;
    const url = [...row[1].matchAll(/href="(https?:\/\/[^"]+)"/g)]
      .map((l) => l[1])
      .filter((l) => !/twitter\.com|x\.com|coinacademy\.fr/.test(l))
      .pop();
    // Curated links occasionally rot into non-URLs ("utm_source=…").
    try {
      if (!url || !new URL(url).hostname.includes(".")) continue;
    } catch {
      continue;
    }
    const src = /<a /.test(cells[1]);
    const [ci, ti, tyi, li] = src ? [2, 3, 4, 5] : [1, 2, 3, 4];
    const loc = plain(cells[li]);
    const dm = plain(cells[0])
      .toLowerCase()
      .replace(/\./g, "")
      .match(/(\d{1,2})\s+([a-zàâäéèêëîïôöùûü]+)\s*(\d{4})?/);
    let posted = "";
    if (dm) {
      const d = new Date(`${dm[1]} ${frMonth(dm[2])} ${dm[3] || new Date().getFullYear()}`);
      if (!isNaN(d.getTime())) {
        if (!dm[3] && d.getTime() > Date.now() + 7 * 86400000) d.setFullYear(d.getFullYear() - 1);
        posted = d.toISOString();
      }
    }
    out.push(
      job("coinacademy", {
        id: createHash("sha1")
          .update(plain(cells[ci]) + "|" + plain(cells[ti]) + "|" + url)
          .digest("hex")
          .slice(0, 12),
        title: cells[ti],
        company: cells[ci],
        url,
        location: loc.replace(/\s*\((Distant|Remote|Hybride)\)\s*/i, ""),
        eligibility: loc,
        remote: /distant|remote/i.test(loc),
        posted,
        tags: [plain(cells[tyi]), src ? plain(cells[1]) : cells[6] && plain(cells[6])].filter(Boolean),
      }),
    );
  }
  return out;
}
const HN_TITLEISH =
  /\b(engineer|developer|devops|manager|designer|architect|scientist|analyst|consultant|programmer|specialist|director|founder|intern|cto|lead|head of|marketing|writer|recruiter|qa|sdet|sre|platform|product|data|security|support|sales|growth|operations)\b/i;
const HN_PLACEISH = /\b(remote|on-?site|hybrid|location|time\s?zones?|worldwide)\b/i;
const HN_URLISH = /^(https?:|\S+\.(com|io|dev|ai|co|fm|xyz|net|org|us|app|gg|so)\b)/i;
// Comment heads are freeform — "|", "—", or "–" separated depending on month.
const HN_SEP = /\s*[|—–]\s*/;
// Algolia escapes HTML entities inside attribute values too — decodeEntities
// above covers them before any href/body parsing (&#x2F; is "/", &quot; a quote).
// Shared parser for one "Who is hiring" comment body (HTML), whether it came
// from hnhiring.com markup or the Algolia HN API.
function hnCommentJob(body: string, id: string, posted: string | undefined): Job | null {
  const head = plain(body.split(/<p[ >]|<br/i)[0]);
  // "Who wants to be hired" seeker posts share the thread's pipe format —
  // signature fields (willing to relocate, résumé/cv, technologies) mark them.
  if (/willing to relocate|r[ée]sum[ée]\/cv|resume\/cv|available for hire|seeking (a )?(role|position)/i.test(head))
    return null;
  const segs = head
    .split(HN_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 2) return null; // not a "Company | Role | …" post
  const first = segs[0];
  const firstLoc = [...first.matchAll(/\(([^)]*)\)/g)]
    .map((m) => m[1].trim())
    .find((inner) => HN_PLACEISH.test(inner) && !/https?:/i.test(inner));
  const company = first
    .replace(/\(\s*https?:[^)]*\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\(([^)]*)\)/g, (m, inner) => (HN_PLACEISH.test(inner) || /https?:/i.test(inner) ? " " : m))
    .replace(/^(company)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const rest = (/^location\s*:/i.test(first) ? segs : segs.slice(1))
    .map((s) =>
      s
        .replace(/\(\s*https?:\/\/[^)]*\)/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\(([^()]*)\)$/, "$1"),
    )
    .filter(Boolean);
  const locSeg = rest.find((s) => HN_PLACEISH.test(s)) || firstLoc || "";
  const title = (
    rest.find((s) => HN_TITLEISH.test(s)) ||
    rest.find((s) => s !== locSeg && !HN_URLISH.test(s)) ||
    ""
  ).slice(0, 140);
  const tags = rest.filter((s) => s !== title && s !== locSeg && !HN_URLISH.test(s)).slice(0, 6);
  const links = [...body.matchAll(/href="(https?:\/\/(?!news\.ycombinator\.com)[^"]+)"/g)].map((x) => x[1]);
  // First link is usually the company domain in the header line; prefer a
  // link with a real path (the "Apply:" / "Details:" URL) when present.
  const url =
    links.find((l) => {
      try {
        return new URL(l).pathname.length > 1;
      } catch {
        return false;
      }
    }) || links[0];
  return job("hnhiring", {
    id,
    title: title || company,
    company,
    url: url || "https://hnhiring.com/locations/remote#" + id,
    location: locSeg,
    eligibility: locSeg,
    remote: /remote/i.test(locSeg || head),
    posted,
    tags,
    summary: plain(body),
  });
}
function hnhiringJobs(html: string): Job[] {
  const out: Job[] = [];
  for (const m of html.matchAll(
    /<li class="job[^"]*"[\s\S]*?<div class="body">([\s\S]*?)<\/div>\s*<\/div>\s*<\/li>/g,
  )) {
    const li = m[0],
      body = m[1];
    const head = plain(body.split(/<p[ >]|<br/i)[0]);
    const id = createHash("sha1")
      .update(head + "|" + body)
      .digest("hex")
      .slice(0, 12);
    const j = hnCommentJob(body, id, (li.match(/class="[^"]*type-info[^"]*"[^>]*>([^<]+)</) || [])[1]);
    if (j) out.push(j);
  }
  return out;
}
// Permanent fallback: hnhiring.com just renders the monthly HN "Who is hiring"
// thread. When the site itself blocks us (Cloudflare 403s), fetch the same
// comments straight from the Algolia HN API — no bot protection there.
async function hnAlgoliaJobs(): Promise<Job[]> {
  const opts = { signal: AbortSignal.timeout(18000), cache: "no-store" as const };
  const s = await fetch(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=" +
      encodeURIComponent("Ask HN: Who is hiring?") +
      "&hitsPerPage=15",
    opts,
  );
  if (!s.ok) throw Error(`Algolia search HTTP ${s.status}`);
  const search = await s.json();
  const thread = (search.hits || []).find((h: any) => /^Ask HN:\s*Who is hiring\?/i.test(h.title || ""));
  if (!thread) throw Error("HN hiring thread not found");
  const r = await fetch(`https://hn.algolia.com/api/v1/items/${thread.objectID}`, opts);
  if (!r.ok) throw Error(`Algolia items HTTP ${r.status}`);
  const item = await r.json();
  const out: Job[] = [];
  for (const c of item.children || []) {
    if (!c.text || c.deleted || c.dead) continue;
    const j = hnCommentJob(decodeEntities(c.text), "hn" + c.id, c.created_at);
    if (j) out.push(j);
  }
  if (!out.length) throw Error("HN thread parsed to zero jobs");
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
    getroFeed("getro", 20916),
    getroFeed("solana", 858, "https://jobs.solana.com"),
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
    {
      id: "cryptojobslist",
      provider: "cryptojobslist",
      url: "https://api.cryptojobslist.com/jobs.rss",
      ttl: 6 * H,
      html: true,
      map: cryptojobslistJobs,
    },
    {
      id: "remote3",
      provider: "remote3",
      url: "https://www.remote3.co/api/rss",
      ttl: 6 * H,
      html: true,
      map: remote3Jobs,
    },
    {
      id: "cryptojobs",
      provider: "cryptojobs",
      url: "https://crypto.jobs/feed/rss",
      ttl: 6 * H,
      html: true,
      map: cryptojobsFeedJobs,
    },
    {
      id: "jobsweb3",
      provider: "jobsweb3",
      url: "https://jobsweb3.io/",
      ttl: 6 * H,
      html: true,
      map: jobsweb3Jobs,
    },
    {
      id: "coinacademy",
      provider: "coinacademy",
      url: "https://coinacademy.fr/offres-emploi-crypto/",
      ttl: 6 * H,
      html: true,
      map: coinacademyJobs,
    },
    {
      id: "hashtagweb3",
      provider: "hashtagweb3",
      url: "https://hashtagweb3.com/data/jobs-runtime.json",
      ttl: 6 * H,
      map: (d) =>
        (Array.isArray(d) ? d : [])
          .filter((r: Row) => r.active !== false)
          .map((r: Row) =>
            job("hashtagweb3", {
              id: r.id,
              title: r.title,
              company: r.company,
              url: r.link,
              location: r.location,
              eligibility: r.location,
              remote: r.isRemote === true || /remote/i.test(r.workplaceType || "") || /^remote/i.test(r.location || ""),
              posted: r.date,
              tags: [r.department, r.workplaceType, r.salary].filter(Boolean),
            }),
          ),
    },
    {
      id: "hnhiring",
      provider: "hnhiring",
      url: "https://hnhiring.com/locations/remote",
      ttl: 6 * H,
      html: true,
      map: hnhiringJobs,
      fallback: hnAlgoliaJobs,
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
