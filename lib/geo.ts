import data from "world-countries";
export type Country = {
  code: string;
  name: string;
  official: string;
  region: string;
  subregion: string;
  aliases: string[];
};
const aliases: Record<string, string[]> = {
  ET: ["Etiopia", "Ethiopia", "Ethiopie", "ኢትዮጵያ"],
  GB: ["UK", "United Kingdom", "Britain", "Great Britain"],
  US: ["USA", "United States", "United States of America", "U.S.A.", "U.S."],
  AE: ["UAE"],
  CZ: ["Czech Republic"],
  CI: ["Ivory Coast"],
  KR: ["South Korea"],
  KP: ["North Korea"],
  TR: ["Turkey", "Türkiye"],
  CD: ["DR Congo", "DRC", "Democratic Republic of the Congo"],
  CG: ["Republic of the Congo"],
  SZ: ["Swaziland"],
  CV: ["Cape Verde"],
  TL: ["East Timor"],
  MM: ["Burma"],
  VA: ["Vatican City"],
};
export const countries: Country[] = data
  .map((c) => ({
    code: c.cca2,
    name: c.name.common,
    official: c.name.official,
    region: c.region || "Antarctic",
    subregion: c.subregion || "Antarctic",
    aliases: [c.cca3, ...(aliases[c.cca2] || [])],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const codes = (s: string) => s.split(" ");
const middleEast = codes("AE BH CY EG IL IQ IR JO KW LB OM PS QA SA SY TR YE");
export const groups: Record<string, string[]> = {};
for (const c of countries) for (const g of new Set([c.region, c.subregion])) groups[g] = [...(groups[g] || []), c.code];
groups["EU"] = codes("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE");
groups["EEA"] = [...groups.EU, ...codes("IS LI NO")];
groups["EMEA"] = [...new Set([...groups.Europe, ...groups.Africa, ...middleEast])];
groups["APAC"] = countries
  .filter((c) => (c.region === "Asia" && !middleEast.includes(c.code)) || c.region === "Oceania")
  .map((c) => c.code);
groups["LATAM"] = countries
  .filter((c) => ["South America", "Central America", "Caribbean"].includes(c.subregion))
  .map((c) => c.code);
groups["MENA"] = [...new Set([...(groups["Northern Africa"] || []), ...middleEast])];
groups["Worldwide"] = countries.map((c) => c.code);
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function searchCountries(q: string) {
  const n = normalize(q);
  return countries.filter((c) =>
    [c.name, c.official, c.code, ...c.aliases, c.region, c.subregion].some((x) => normalize(x).includes(n)),
  );
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Consume longer names first: South Sudan must not also match Sudan;
// Equatorial Guinea must not also match Guinea. Compiled once at load —
// this runs per job per refresh, so per-call construction was the hot path.
const ALIAS_PATTERNS = countries
  .flatMap((c) =>
    [c.name, c.official, ...c.aliases]
      .filter((a) => a.length >= 3)
      .map((alias) => {
        const a2 = normalize(alias);
        return { code: c.code, alias: a2, re: new RegExp("(^|[^a-z])" + escape(a2) + "(?=[^a-z]|$)", "g") };
      }),
  )
  .sort((a, b) => b.alias.length - a.alias.length);
const COUNTRY_NAME_STRIP = new RegExp(
  "(^|[^a-z])(" +
    [...new Set(countries.flatMap((c) => [c.name, c.official]))]
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join("|") +
    ")([^a-z]|$)",
  "ig",
);
const GROUP_PATTERNS = Object.keys(groups)
  .filter((g) => g !== "Worldwide")
  .sort((a, b) => b.length - a.length)
  .map((g) => ({
    group: g,
    aliases: (g === "EU"
      ? ["EU", "European Union"]
      : g === "EEA"
        ? ["EEA", "European Economic Area"]
        : g === "EMEA"
          ? ["EMEA"]
          : g === "APAC"
            ? ["APAC", "Asia Pacific", "Asia-Pacific"]
            : g === "LATAM"
              ? ["LATAM", "Latin America"]
              : [g]
    ).map((a) => new RegExp("(^|[^a-z])" + escape(a) + "([^a-z]|$)", "ig")),
  }));
const US_TAIL = /,\s*[A-Z]{2}\s*,\s*(US|USA|United States)\b/;
const UK_WORD = /\bUK\b/;
// Bare "US" embedded in a token ("US only", "US time zones") — the token
// splitter needs an exact match, and 2-char aliases are filtered below.
const US_WORD = /\bUS\b/;
const CITIES = new Map(
  Object.entries({
    "addis ababa": "ET",
    "addis abeba": "ET",
    "dire dawa": "ET",
    berlin: "DE",
    munich: "DE",
    london: "GB",
  }).map(([city, code]) => [new RegExp("\\b" + city + "\\b"), code] as const),
);
function names(text: string) {
  const n = normalize(text),
    found = new Set<string>();
  const tokens = text.split(/[,;/|()]/).map((x) => x.trim());
  const usTail = US_TAIL.test(text);
  for (const c of countries) if (tokens.includes(c.code) && !(usTail && c.code !== "US")) found.add(c.code);
  let remaining = n;
  for (const { code, alias, re } of ALIAS_PATTERNS) {
    if ((alias === "congo" || alias === "georgia") && n !== alias) continue;
    re.lastIndex = 0;
    if (re.test(remaining)) {
      found.add(code);
      re.lastIndex = 0;
      remaining = remaining.replace(re, " ");
    }
  }
  if (UK_WORD.test(text)) found.add("GB");
  if (US_WORD.test(text)) found.add("US");
  // A small unambiguous city dictionary; other city-only locations remain unknown.
  for (const [re, code] of CITIES) if (re.test(n)) found.add(code);
  return [...found];
}
export type Scope = {
  countries: string[];
  groups: string[];
  worldwide: boolean;
  unknown: boolean;
  raw: string;
  excluded: string[];
  uncertain: boolean;
};
const SPLIT_EXCEPT = /\b(?:except|excluding|not including)\b/i;
const WORLDWIDE = /\b(worldwide|world wide|anywhere|global|work from anywhere)\b/i;
const UNCERTAIN =
  /\b(time\s?zone|utc|gmt|citizen|visa|authorization|authorisation|eligible|must|only if|not available|not in|excluding|except|not including)\b/i;
const scopeCache = new Map<string, Scope>();
const SCOPE_CACHE_MAX = 5000;
export function parseScope(raw: string): Scope {
  const cached = scopeCache.get(raw);
  if (cached) return cached;
  const parts = raw.split(SPLIT_EXCEPT);
  const include = parts[0],
    foundGroups: string[] = [];
  let groupText = include.replace(COUNTRY_NAME_STRIP, " ");
  for (const { group, aliases } of GROUP_PATTERNS) {
    if (aliases.some((a) => (a.lastIndex = 0) === 0 && a.test(groupText))) {
      foundGroups.push(group);
      for (const a of aliases) {
        a.lastIndex = 0;
        groupText = groupText.replace(a, " ");
      }
    }
  }
  const worldwide = WORLDWIDE.test(include);
  const excluded = parts.length > 1 ? names(parts.slice(1).join(" ")) : [];
  const explicit = names(include);
  const result = [...new Set([...explicit, ...foundGroups.flatMap((g) => groups[g])])].filter(
    (c) => !excluded.includes(c),
  );
  const scope: Scope = {
    countries: result,
    groups: foundGroups,
    worldwide,
    unknown: !worldwide && !result.length,
    raw,
    excluded,
    uncertain: UNCERTAIN.test(raw),
  };
  if (scopeCache.size >= SCOPE_CACHE_MAX) scopeCache.delete(scopeCache.keys().next().value!);
  scopeCache.set(raw, scope);
  return scope;
}
export function scopeMatches(scope: Scope, selected: string, allowGroups = true) {
  if (scope.uncertain) return false;
  const targets = groups[selected] || [selected];
  return (
    targets.some((c) => !scope.excluded.includes(c) && (scope.worldwide || scope.countries.includes(c))) &&
    (allowGroups || !scope.groups.length)
  );
}
