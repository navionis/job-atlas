# job-atlas

Job feed

Aggregates public job feeds (crypto/web3 boards included) behind a
rate-limited server cache, served via REST + SSE.

## Sources

Enabled by default (no credentials): Remotive, Remote OK, Arbeitnow,
Cryptocurrency Jobs (engineering), Web3.career (remote), Jump Crypto
Network (Getro board), RareTalent (remote), FindWeb3 (engineering),
SailOnchain (remote). Credentialed providers (The Muse, Adzuna,
Greenhouse/Lever/Ashby/SmartRecruiters boards, Jooble, USAJOBS,
ReliefWeb, Reed) activate via `.env.local` — see `.env.example`.

## Storage

When `DATABASE_URL` is set, feed state and collected jobs persist to
PostgreSQL in `feed_state`, `feed_attempts` and `jobs` tables
(`DATABASE_SSL=true` for hosted databases). Without it the app falls
back to `DATA_DIR/feeds.json`. Run a single Node process either way.

## Development

```sh
npm install
cp .env.example .env.local   # set DATABASE_URL for Postgres
npm run dev
npm test                     # adapters + storage (pg-mem) + geo
npm run typecheck && npm run build
```
