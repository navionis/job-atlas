import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { pgEnabled, dbLoadProfile, dbSaveProfile, dbListProfileEmails } from "./db";
import type { JobsMeta, Profile } from "./types";
import type { Session } from "./auth";
const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
const file = join(dir, "profiles.json");
function loadAll(): Record<string, Profile> {
  try {
    const d = JSON.parse(readFileSync(file, "utf8"));
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}
function saveAll(all: Record<string, Profile>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file + ".tmp", JSON.stringify(all));
  renameSync(file + ".tmp", file);
}
export function emptyProfile(): Profile {
  return { keywords: [], excluded: [], resumes: [], sourceRank: {}, filters: {} };
}
export function effectiveKeywords(p: Profile): string[] {
  const ex = new Set((p.excluded || []).map((k) => k.toLowerCase()));
  const all = new Set<string>();
  for (const r of p.resumes || []) for (const k of r.keywords || []) all.add(k);
  for (const k of p.keywords || []) all.add(k);
  return [...all].filter((k) => !ex.has(k.toLowerCase())).slice(0, 40);
}
export async function getProfile(email: string): Promise<Profile> {
  const key = email.toLowerCase();
  if (pgEnabled()) {
    const d = await dbLoadProfile(key);
    return { ...emptyProfile(), ...(d || {}) };
  }
  return { ...emptyProfile(), ...(loadAll()[key] || {}) };
}
export async function listProfileEmails(): Promise<string[]> {
  if (pgEnabled()) return dbListProfileEmails();
  return Object.keys(loadAll());
}
export async function saveProfile(email: string, p: Profile) {
  const key = email.toLowerCase();
  if (pgEnabled()) {
    await dbSaveProfile(key, p);
    return;
  }
  const all = loadAll();
  all[key] = p;
  saveAll(all);
}
const STOP = new Set(
  "a,an,the,and,or,of,to,in,for,on,at,with,by,from,as,is,are,was,were,be,been,being,this,that,these,those,you,your,we,our,they,their,i,me,my,he,she,his,her,it,its,will,would,can,could,should,may,might,must,have,has,had,do,does,did,not,no,but,if,than,then,so,such,all,any,both,each,more,most,other,some,own,same,very,just,about,over,into,out,up,down,after,before,between,under,again,further,once,here,there,when,where,why,how,who,whom,which,what,experience,experienced,years,year,work,working,worked,team,teams,role,roles,job,skills,skill,strong,knowledge,ability,able,excellent,good,great,best,new,well,within,across,including,include,includes,included,using,use,used,etc,plus,preferred,familiar,understanding,responsibilities,requirements,required,help,helping,ensure,ensuring,support,supporting,related,field,degree,bachelor,master,university,college,education,candidate,candidates,position,company,corp,inc,ltd,llc,salary,benefits,equal,opportunity,employer,employment,apply,application,resume,cover,letter,references,day,daily,time,full,part,level,senior,junior,mid,manager,management,lead,leading,leader,develop,developing,developed,solutions,solution,system,systems,service,services,business,products,product,platform,platforms,customers,customer,clients,client,users,user,people,person,environment,process,processes,model,models,tools,tool,technology,technologies,technical,provide,providing,proven,successful,complex,multiple,various,high,highly,minimum,current,world,global,growth,drive,driving,deliver,delivering,impact,passionate,love,join,looking".split(
    ",",
  ),
);
const SKILLS = [
  "javascript",
  "typescript",
  "react",
  "next.js",
  "nextjs",
  "node.js",
  "nodejs",
  "vue",
  "angular",
  "svelte",
  "redux",
  "webpack",
  "vite",
  "tailwind",
  "css",
  "html",
  "sass",
  "python",
  "django",
  "flask",
  "fastapi",
  "java",
  "spring",
  "kotlin",
  "scala",
  "golang",
  "rust",
  "c++",
  "c#",
  ".net",
  "php",
  "laravel",
  "symfony",
  "ruby",
  "rails",
  "swift",
  "objective-c",
  "sql",
  "mysql",
  "postgresql",
  "postgres",
  "mongodb",
  "redis",
  "elasticsearch",
  "dynamodb",
  "cassandra",
  "sqlite",
  "graphql",
  "rest",
  "grpc",
  "aws",
  "azure",
  "gcp",
  "google cloud",
  "docker",
  "kubernetes",
  "k8s",
  "terraform",
  "ansible",
  "jenkins",
  "ci/cd",
  "devops",
  "linux",
  "unix",
  "bash",
  "git",
  "github",
  "gitlab",
  "agile",
  "scrum",
  "kanban",
  "jira",
  "react native",
  "flutter",
  "android",
  "ios",
  "mobile",
  "machine learning",
  "deep learning",
  "tensorflow",
  "pytorch",
  "keras",
  "scikit-learn",
  "pandas",
  "numpy",
  "spark",
  "kafka",
  "hadoop",
  "airflow",
  "etl",
  "data engineering",
  "data science",
  "analytics",
  "tableau",
  "power bi",
  "excel",
  "statistics",
  "nlp",
  "llm",
  "ai",
  "openai",
  "langchain",
  "solidity",
  "web3",
  "blockchain",
  "ethereum",
  "smart contracts",
  "defi",
  "nft",
  "cryptography",
  "security",
  "penetration testing",
  "oauth",
  "jwt",
  "microservices",
  "serverless",
  "lambda",
  "rabbitmq",
  "nginx",
  "apache",
  "firebase",
  "supabase",
  "prisma",
  "docker compose",
  "figma",
  "sketch",
  "photoshop",
  "illustrator",
  "ux",
  "ui",
  "figma",
  "wireframing",
  "prototyping",
  "seo",
  "sem",
  "content marketing",
  "copywriting",
  "social media",
  "google analytics",
  "hubspot",
  "salesforce",
  "marketing",
  "sales",
  "account management",
  "business development",
  "accounting",
  "bookkeeping",
  "quickbooks",
  "finance",
  "financial analysis",
  "auditing",
  "tax",
  "payroll",
  "hr",
  "recruiting",
  "talent acquisition",
  "onboarding",
  "customer support",
  "customer success",
  "project management",
  "product management",
  "scrum master",
  "pmp",
  "nursing",
  "clinical",
  "patient care",
  "teaching",
  "curriculum",
  "tutoring",
  "writing",
  "editing",
  "translation",
  "video editing",
  "cad",
  "autocad",
  "solidworks",
  "matlab",
  "verilog",
  "embedded",
  "firmware",
  "iot",
  "networking",
  "cisco",
  "voip",
  "sap",
  "erp",
  "crm",
  "consulting",
  "strategy",
  "operations",
  "supply chain",
  "logistics",
  "procurement",
  "qa",
  "testing",
  "automation",
  "selenium",
  "cypress",
  "jest",
  "pytest",
];
export function extractKeywords(text: string, max = 30): string[] {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z][a-z0-9+#.]{1,}/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    const c = w.replace(/^[.]+|[.]+$/g, "");
    if (c.length < 3 || STOP.has(c)) continue;
    freq.set(c, (freq.get(c) || 0) + 1);
  }
  const dict = new Set(SKILLS);
  const picks: string[] = [];
  for (const w of freq.keys()) if (dict.has(w)) picks.push(w);
  for (const s of SKILLS) if (s.includes(" ") && lower.includes(s)) picks.push(s);
  const rest = [...freq.entries()]
    .filter(([w, n]) => !dict.has(w) && n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
  return [...new Set([...picks, ...rest])].slice(0, max);
}

/** Discover-page meta for a session (or guest): keywords, ranks, saved filters, resumes. */
export async function jobsMeta(me: Session | null): Promise<JobsMeta> {
  const p = me ? await getProfile(me.email).catch(() => null) : null;
  return {
    guest: !me,
    keywords: p ? effectiveKeywords(p) : [],
    sourceRank: p?.sourceRank || {},
    filters: p?.filters || {},
    resumes: (p?.resumes || []).map((r) => ({ id: r.id, name: r.name, alias: r.alias, keywords: r.keywords })),
    manual: p?.keywords || [],
    excluded: p?.excluded || [],
  };
}
