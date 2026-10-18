// Fetches each source's favicon into public/favicons/<id>.png.
// Run: node scripts/fetch-favicons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCES = {
  ziprecruiter: "ziprecruiter.com",
  glassdoor: "glassdoor.com",
  monster: "monster.com",
  dice: "dice.com",
  reliefweb: "reliefweb.int",
  reed: "reed.co.uk",
  eures: "eures.europa.eu",
  remotive: "remotive.com",
  remoteok: "remoteok.com",
  arbeitnow: "arbeitnow.com",
  muse: "themuse.com",
  greenhouse: "greenhouse.io",
  lever: "lever.co",
  ashby: "ashbyhq.com",
  smartrecruiters: "smartrecruiters.com",
  adzuna: "adzuna.com",
  jooble: "jooble.org",
  usajobs: "usajobs.gov",
  jsearch: "openwebninja.com",
  careerjet: "careerjet.com",
  linkedin: "linkedin.com",
  indeed: "indeed.com",
  cryptocurrencyjobs: "cryptocurrencyjobs.co",
  web3career: "web3.career",
  getro: "jumpcrypto.com",
  raretalent: "raretalent.xyz",
  findweb3: "findweb3.com",
  sailonchain: "sailonchain.com",
  hnhiring: "hnhiring.com",
};

const out = join(process.cwd(), "public", "favicons");
mkdirSync(out, { recursive: true });
for (const [id, domain] of Object.entries(SOURCES)) {
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) throw Error("empty icon");
    writeFileSync(join(out, `${id}.png`), buf);
    console.log(`ok  ${id}  ${buf.length}b`);
  } catch (e) {
    console.log(`ERR ${id}  ${e.message}`);
  }
}
