# backend — Aquarium API

Hono API for the private `/aquarium` area: projects and the links attached to them.
Sign-in is Google via [`hono-auth-core`](https://www.npmjs.com/package/hono-auth-core),
restricted to the emails in `OWNER_EMAILS`. Data is Postgres on [Neon](https://neon.tech) via Drizzle
(`drizzle-orm/neon-http` — plain HTTPS per query, no connection pool to manage on Cloudflare Workers).

## Local setup

1. **Google OAuth client** — Google Cloud Console → APIs & Services → Credentials →
   Create credentials → OAuth client ID → *Web application*.
   - Authorized redirect URI: `http://localhost:8787/api/auth/google/callback`
2. **Neon** — create a project at neon.tech (e.g. Frankfurt, close to you and to Cloudflare).
   In *Branches* create a `dev` branch for local work, so experiments never touch production data.
   *Connect* → pick the `dev` branch → copy the **pooled** string into `DATABASE_URL`
   and the direct one (toggle "Connection pooling" off) into `DATABASE_URL_UNPOOLED`.
3. **Env**
   ```bash
   cp .env.example .env
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # → JWT_SECRET
   ```
   Fill in `OWNER_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL(_UNPOOLED)`.
4. **Install, create the tables, run**
   ```bash
   pnpm install
   pnpm db:migrate     # applies ./drizzle to the Neon branch in DATABASE_URL
   pnpm dev            # http://localhost:8787/api/health
   ```
5. Sign in: open `http://localhost:8787/api/auth/google/login` → after Google you land on
   `FRONTEND_URL/aquarium`. Then `http://localhost:8787/api/me` shows who you are.

> Safari doesn't keep `Secure` cookies on plain `http://localhost` — use Chrome/Firefox for local dev.

## API

All under `/api`. Everything except `health`, `auth/*`, `me` needs an owner session.

| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/health` | |
| GET | `/auth/google/login` | `?returnTo=` etc. round-trips |
| GET | `/auth/google/callback` | (Google redirects here) |
| POST | `/auth/refresh` | reissues the 15-min access token from the 30-day refresh cookie |
| POST | `/auth/logout` | |
| GET | `/me` | → `{ email, name, avatarUrl }` or 401 |
| GET | `/groups` | → `{ items: Group[] }` |
| POST | `/groups` | `{ name, sortOrder? }` |
| PATCH | `/groups/:id` | `{ name?, sortOrder? }` |
| DELETE | `/groups/:id` | its projects stay, with `groupId: null` |
| GET | `/projects` | `?status=active&q=text` → `{ items: Project[] }` (with links) |
| POST | `/projects` | `{ title, description?, status?, tags?, groupId?, sortOrder?, links?: Link[] }` |
| GET | `/projects/:id` | |
| PATCH | `/projects/:id` | any of `title, description, status, tags, groupId, sortOrder` |
| DELETE | `/projects/:id` | deletes its links too |
| POST | `/projects/:id/links` | `{ label, url, kind?, sortOrder? }` — appended to the end by default |
| PATCH | `/links/:id` | any of `label, url, kind, sortOrder` |
| DELETE | `/links/:id` | |

- `status`: `idea | active | paused | done | archived`
- `kind`: `github | deploy | figma | notion | docs | design | drive | other`
- `url` must be `http(s)://` (so nothing like `javascript:` can end up in an `href`).
- Errors: `{ error }`, validation → `400 { error: "validation_error", issues: [{ path, message }] }`.

Calling from the browser: `fetch(url, { credentials: "include" })`. On `401`, call
`POST /api/auth/refresh` once and retry; if that's also 401, send the user to the login URL.
For a typed client: `import type { AppType } from "../backend/src/app"` + `hc<AppType>(API_URL)` from `hono/client`.

## Changing the schema

Edit `src/db/schema.ts` → `pnpm db:generate` → commit the new file in `drizzle/` → `pnpm db:migrate`.
`pnpm db:studio` opens a browser UI for the DB (Neon's dashboard also has a Tables view and SQL editor).

## Deploy (Cloudflare Workers + Neon)

The same app runs on Cloudflare Workers: `src/index.ts` is the Worker entry, settings live in
`wrangler.jsonc`. `nodejs_compat` fills `process.env` from Worker vars and secrets, so `src/env.ts`
is shared by Node (local `pnpm dev`) and Cloudflare.

1. **Log in**: `npx wrangler login`.
2. **Domain**: the API must live on a subdomain of the site (`api.pavlotishynin.com`), otherwise
   the session cookies are third-party for `www.pavlotishynin.com` and browsers drop them.
   The `routes` entry in `wrangler.jsonc` creates that custom domain on deploy — the
   `pavlotishynin.com` zone has to be in your Cloudflare account (the site's own DNS records can
   keep pointing at Vercel).
3. **Public settings**: check `vars` in `wrangler.jsonc` (`API_URL`, `FRONTEND_URL`,
   `OWNER_EMAILS`, `GOOGLE_CLIENT_ID`, `COOKIE_DOMAIN`). `FRONTEND_URL` must be the exact origin the
   site is served from (`https://www.pavlotishynin.com`) — CORS allows only that origin.
4. **Secrets** (once, and whenever they change):
   ```bash
   npx wrangler secret put JWT_SECRET            # a NEW random value, not the local one
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put DATABASE_URL          # Neon production branch, pooled string
   ```
5. **Database**: apply migrations to the production branch before deploying a schema change:
   `pnpm db:migrate` with the production `DATABASE_URL(_UNPOOLED)` in `.env`.
6. **Google**: add `https://api.pavlotishynin.com/api/auth/google/callback` as an authorized
   redirect URI of the OAuth client.
7. **Deploy**: `pnpm run deploy`. Check `https://api.pavlotishynin.com/api/health`.
8. **Frontend** (Vercel): set `PUBLIC_API_URL=https://api.pavlotishynin.com` and redeploy.

Logs: `npx wrangler tail`, or Workers → aquarium-api → Logs in the dashboard.

To run the Worker runtime locally instead of Node: copy `.dev.vars.example` to `.dev.vars`,
fill it like `.env`, then `pnpm dev:worker` (same port, 8787).
