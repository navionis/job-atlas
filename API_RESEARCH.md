# Job-feed API research

Checked October 6, 2026 against linked provider documentation. 23 sources surveyed; 13 implemented connectors. This is broad coverage of public and partner APIs, not an exhaustive inventory of every job site. “Not published” means a numerical limit was not found in the checked official documentation, not unlimited access.

## Source comparison

All implemented connectors use HTTPS REST. No public upstream WebSocket job-listing stream was verified in this survey. Some vendors offer employer/account webhooks for applications or publishing; those are not global job feeds. This project uses server-sent events (SSE) for browser updates from a rate-limited cache.

| Source and primary documentation | Access | Rate limit / quota | Coverage | Project status | App refresh |
|---|---|---|---|---|---|
| [ZipRecruiter](https://api.ziprecruiter.com/mcp/docs) | Publisher agreement; separate search MCP | Public numerical request quota not verified; search MCP up to 5 results/call | Search MCP documents US/CA only; Jobs API is partner CRUD | Research only | Not connected |
| [Glassdoor](https://www.glassdoor.com/crs/api/glassdoor-public-api-terms.pdf) | Current open job-search API not verified | Current public quota not verified | Historical API terms do not establish current feed availability | Research only | Not connected |
| [Monster](https://jsi.monster.com/Jsx.aspx) | Syndication / partner access | Current public quota not verified | Syndication tool found; no verified open feed connected | Research only | Not connected |
| [Dice](https://www.dice.com/support/employer-help/integration-capabilities--instructions.html) | Employer / ATS integration | Public job-search quota not verified | Documented integrations post jobs into Dice | Research only | Not connected |
| [ReliefWeb](https://apidoc.reliefweb.int/) | Pre-approved appname | 1,000 calls/day; 1,000 records/call | Humanitarian jobs globally · Ethiopia-focused query configurable | Connector implemented; credentials/boards may be required | 6 hours (app policy) |
| [Reed](https://www.reed.co.uk/developers/jobseeker) | API key (Basic auth) | Jobseeker rate quota not published in checked docs; max 100 results/search | UK-focused · first 100 | Connector implemented; credentials/boards may be required | 6 hours (app policy) |
| [EURES](https://eures.europa.eu/eures-services/help-and-support_en) | Recognized partner organizations only | Partner-specific; no public numerical quota verified | European employment network | Research only | Not connected |
| [Ethiojobs](https://www.ethiojobs.net/) | No official public feed verified | No official public API quota verified | Ethiopia · third-party wrappers are not official APIs | Research only | Not connected |
| [Remotive](https://github.com/remotive-com/remote-jobs-api) | Public | Recommend ≤4/day; >2/min blocked | Remote · worldwide restrictions vary | Connector implemented; credentials/boards may be required | 6 hours |
| [Remote OK](https://remoteok.com/faq) | Public | Numeric limit not published in checked docs | Remote · location often incomplete | Connector implemented; credentials/boards may be required | 1 hour (app policy) |
| [Arbeitnow](https://www.arbeitnow.com/blog/job-board-api) | Public | Numeric limit not published in checked docs | Europe-heavy · first page | Connector implemented; credentials/boards may be required | 1 hour (app policy) |
| [The Muse](https://www.themuse.com/developers/api/v2) | Key for production | 500/hour testing; 3,600/hour registered | International · first page | Connector implemented; credentials/boards may be required | 1 hour (app policy) |
| [Greenhouse](https://docs.greenhouse.io/job-board.html) | Public company boards | Public GET numeric limit not found; Harvest limits are separate | Only configured company boards | Connector implemented; credentials/boards may be required | 1 hour per board (app policy) |
| [Lever](https://github.com/lever/postings-api) | Public company boards | GET limit not published; 2/sec applies to application POST only | Only configured company boards | Connector implemented; credentials/boards may be required | 1 hour per board (app policy) |
| [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api) | Public company boards | Public Posting API limit not found; authenticated API limits separate | Only configured company boards | Connector implemented; credentials/boards may be required | 1 hour per board (app policy) |
| [SmartRecruiters](https://developers.smartrecruiters.com/docs/customer-overview) | Public company boards | Customer API: 10/sec, 8 concurrent; anonymous limit not separately stated | Configured boards · first 100 each | Connector implemented; credentials/boards may be required | 1 hour per board (app policy) |
| [Adzuna](https://developer.adzuna.com/docs/terms_of_service) | App ID + key | 25/min; 250/day; 1,000/week; 2,500/month | Configured supported market · first 50 | Connector implemented; credentials/boards may be required | 6 hours (app policy) |
| [Jooble](https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation) | Country-specific key + opt-in | Free: 500 requests total lifetime per key | Configured key country/search · first page | Connector implemented; credentials/boards may be required | 24 hours (app policy) |
| [USAJOBS](https://developer.usajobs.gov/guides/rate-limiting) | API key + email | 500 rows/page; 10,000/query. Request-rate quota not stated | US federal jobs incl. overseas · first 100 | Connector implemented; credentials/boards may be required | 6 hours (app policy) |
| [JSearch / OpenWeb Ninja](https://www.openwebninja.com/api/jsearch) | Paid / free tier | Free 200/month, 1,000/hour; Pro 10,000/month, 5/sec; Ultra 50,000/month, 10/sec; Mega 200,000/month, 20/sec | Third-party aggregation; not an official LinkedIn API | Research only | Not connected |
| [Careerjet](https://www.careerjet.com/partners/api) | Publisher key | Numeric limit not published in checked docs; confirm account quota | Locale-specific publisher search | Research only | Not connected |
| [LinkedIn](https://www.linkedin.com/legal/l/job-posting-api-terms) | Approved partners | Contract / endpoint specific | Posting API is not a public job-search feed | Research only | Not connected |
| [Indeed](https://docs.indeed.com/) | Partner / publisher integration | Contract / endpoint specific | Current docs offer publisher plugin; no open REST search verified | Research only | Not connected |

## Important distinctions

- **Remotive:** provider recommends at most four fetches per day; more than two/minute may be blocked. Jobs are delayed 24 hours. Credit Remotive and link to its original listing. Do not redistribute its listings to third-party job boards or put listings behind email/sign-up collection. See [official terms](https://remotive.com/remote-jobs/api).
- **Remote OK / Arbeitnow:** retain source attribution and original links. Hourly fetching is this app's conservative choice, not a documented numerical allowance. [Arbeitnow terms](https://www.arbeitnow.com/terms).
- **Adzuna:** 25/minute, 250/day, 1,000/week and 2,500/month are simultaneous default Job Search API limits. Adzuna Intelligence is a different product; do not transfer its limits to this API. Confirm market availability for your account; an Ethiopia selector does not prove Adzuna Ethiopia coverage. [Search overview](https://developer.adzuna.com/overview).
- **Jooble:** the August 16, 2026 official documentation says 500 total lifetime requests per free key, not per month. Keys are country-specific. The adapter requires a separate opt-in and uses a persistent lifetime counter. Account usage before this installation and outside this app is not known.
- **The Muse:** 500/hour without a key for testing; 3,600/hour registered. Registration is required beyond testing. Rate-limit failures may use HTTP 403. The connector is disabled without a key.
- **Greenhouse:** public Job Board GET endpoints require no authentication. Harvest API limits are not evidence of Job Board limits. Only configured company boards are searched.
- **Lever:** the documented two requests/second rule is for application POST, not public listing GET. The app only reads jobs and links to applications.
- **Ashby:** public posting API is distinct from authenticated API quotas. Unlisted jobs must not be published; the adapter excludes isListed=false.
- **SmartRecruiters:** customer API docs list 10 requests/second and eight concurrent requests. Anonymous Posting API limits are not independently stated; do not assume this is a guaranteed anonymous allowance. Only PUBLIC postings are requested.
- **USAJOBS:** 500 records/page and 10,000/query are result-size limits, not request-per-second limits. US federal employment requirements still apply to overseas/remote roles.
- **ReliefWeb:** 1,000 calls/day, 1,000 records/call. A pre-approved appname has been required since November 1, 2025. Humanitarian jobs make this useful for Ethiopia; the adapter can filter country.iso3=eth. Its Publishing API's 50/day limit is a different endpoint and is not used. [Fields](https://apidoc.reliefweb.int/fields).
- **Reed:** Jobseeker search returns at most 100 per call and uses Basic auth. Numeric Jobseeker request-rate limits were not found. Recruiter quotas and AI-search policies must not be reused for Jobseeker.
- **JSearch:** third-party aggregator, not a first-party LinkedIn/Indeed job feed. Current provider pricing lists Free 200/month and 1,000/hour; Pro 10,000/month and 5/sec; Ultra 50,000/month and 10/sec; Mega 200,000/month and 20/sec; PAYG 5/sec. RapidAPI/account conditions may differ. No key was supplied; no connector is represented as active.
- **Careerjet:** publisher search endpoint is https://search.api.careerjet.net/v4/query, with Basic-auth API key and supported locale_code. A separate api.careerjet.net/v1 API is not a substitute for this search endpoint. Confirm request quotas with the publisher account.
- **ZipRecruiter:** official search MCP docs describe US/Canada search, up to five results/call. Its partner Jobs API manages partner postings. The publisher program has a separate agreement; a public numeric request limit was not verified. [Publisher terms](https://www.ziprecruiter.com/marketplace/publisher_service_terms). Neither interface is automatically connected.
- **LinkedIn / Indeed:** verified partner posting/application interfaces are not open, global REST search feeds. Indeed's current docs offer a Publisher JavaScript Plugin; partner access and quotas must be confirmed.
- **EURES:** extraction is restricted to recognized partner organizations; a reverse-engineered endpoint is not an open API entitlement. No connector is provided. [Portal conditions](https://europa.eu/eures/portal/jv-se/home?lang=sk&pageCode=find_a_job).
- **Ethiojobs:** an official public developer feed was not verified. Third-party wrappers found in search are not treated as an official API. No guessed endpoint is connected.
- **Glassdoor / Monster / Dice:** reviewed historical API terms, a syndication tool, and employer integrations respectively. None establishes an openly available current job-search API plus a verified quota for this project.

## Country filtering architecture

1. Store a complete canonical country catalog separately from any provider's supported countries.
2. Normalize country codes, aliases and explicit source location fields. Keep raw location evidence.
3. Keep listed work location separate from candidate eligibility. Missing eligibility stays unknown.
4. Expand regional labels using visible, editable group memberships. EMEA/APAC/MENA/LATAM definitions vary between employers; they are not legal work-eligibility guarantees.
5. Do not convert a remote flag, a timezone, or a country mentioned somewhere in a description into worldwide eligibility. Complex exclusions and restrictions require review.
6. Display source coverage and fetch failures separately from zero matching jobs.

Country data: [mledoze/world-countries](https://github.com/mledoze/countries), ODbL-1.0. 249 ISO entries plus user-assigned XK for Kosovo. Subregions follow that package, not an assertion of strict UN M49 equivalence. UN reference for comparison: [M49](https://unstats.un.org/unsd/methodology/m49/). Full countries and group memberships ship in data/countries-and-groups.json.

## Verified versus unverified

The Next.js production build and geographic/adapter tests were run. The default public feeds returned 442 jobs during a live development check. Credentialed adapters and configured company boards were validated with fixtures against documented schemas, not with user credentials or real employer-board configuration. Network availability, results, account quotas and provider terms can change.
