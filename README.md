# Lana

A personal finance app: aggregates bank/investment accounts via Plaid, categorizes
transactions, and tracks net worth over time (broken out by asset class — cash,
brokerage, retirement, crypto, real estate, hard assets, liabilities).

Built with Next.js (App Router), deployed to Cloudflare Workers via OpenNext, with
Cloudflare D1 (SQLite) as the database.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values (see below).

3. Apply migrations to your local D1 replica:

   ```bash
   npm run db:migrate:local
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 — click "Continue with Google" to sign in. Only
   the Google account in `GOOGLE_ALLOWED_EMAIL` can sign in; anyone else's
   Google login is rejected.

## Google sign-in setup

Lana has no password — it uses [Google Identity Services](https://developers.google.com/identity/gsi/web)
("Sign in with Google") and locks access to a single email address.

1. Go to the [Google Cloud Console credentials page](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth client ID** → Application type: **Web application**.
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000` (for local dev)
   - your deployed URL, e.g. `https://lana.<your-subdomain>.workers.dev`
   - No redirect URI is needed — this uses the token flow, not a redirect.
4. Copy the generated **Client ID** into `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
5. Set `GOOGLE_ALLOWED_EMAIL` to your own Google account email — sign-in attempts
   from any other account are rejected with a 403.

## Environment variables

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Random string, 32+ characters, used to encrypt the session cookie. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth Client ID from Google Cloud Console (see above). Exposed to the browser — this is expected, it's not a secret. |
| `GOOGLE_ALLOWED_EMAIL` | The only Google account allowed to sign in. |
| `PLAID_CLIENT_ID` | From the [Plaid dashboard](https://dashboard.plaid.com/team-settings/keys). |
| `PLAID_SECRET` | Matching secret for your `PLAID_ENV` (sandbox/development/production). |
| `PLAID_ENV` | `sandbox`, `development`, or `production`. |
| `PLAID_WEBHOOK_URL` | Optional. Your deployed URL + `/api/plaid/webhook`, so Plaid can push transaction updates instead of relying on manual sync. |
| `MX_CLIENT_ID` | From MX's partner dashboard — used for brokerages Plaid doesn't reach (Vanguard, Fidelity, Schwab, Robinhood investing). |
| `MX_API_KEY` | Matching API key for your `MX_ENV`. |
| `MX_ENV` | `sandbox` or `production`. Sandbox uses `int-api.mx.com`, production uses `api.mx.com`. |
| `ERA_API_KEY` | API key from [Era](https://era.app) — used to pull accounts/transactions Era already has connected (e.g. Robinhood Banking/Credit Card) that neither Plaid nor MX can reach directly. |

## MX setup (Vanguard, Fidelity, Schwab, Robinhood investing)

Plaid doesn't support most brokerages' investment accounts, so Lana uses
[MX](https://www.mx.com) as a second aggregator just for those. Everything else
(regular banks, PayPal, credit cards) still goes through Plaid.

**Note:** unlike Plaid, MX doesn't offer instant self-serve signup — getting a
`MX_CLIENT_ID`/`MX_API_KEY` requires going through MX's partner application
process, not just creating an account. Budget for that separately; it's not a
five-minute setup.

1. Apply for MX partner/developer access and grab your **Client ID** and **API
   Key** once approved. Start with the sandbox keys.
2. Set `MX_CLIENT_ID`, `MX_API_KEY`, and `MX_ENV=sandbox` in `.env.local`.
3. On the Dashboard or Accounts page, click **"Link brokerage / bank (MX)"** —
   it opens MX's Connect widget in a modal, the same kind of flow as Plaid Link.
4. Optional: register a webhook in the MX dashboard pointing at
   `<your-deployed-url>/api/mx/webhook` so new transactions sync automatically
   instead of waiting for a manual `/api/mx/sync` call.

Unlike Plaid, MX doesn't have a cursor-based sync — every sync just re-pulls the
last ~120 days of transactions and upserts by MX's transaction GUID, so it's
safe to call `/api/mx/sync` as often as you like.

## Era setup (accounts Era already has connected)

If you use [Era](https://era.app) as a personal finance assistant and it already
has accounts connected (via its own aggregator relationships) that Lana can't
reach through Plaid or MX — e.g. Robinhood Banking/Credit Card — Lana can pull
that same data through Era's MCP-based API, read-only, for accounts that are
actually yours.

**This sync runs from GitHub Actions, not from Lana's own Worker.** Era's
Cloudflare-fronted domain blocks requests that originate from Cloudflare
Workers' network (their WAF treats it as datacenter/bot traffic and returns an
empty 500 before Era's own app code ever runs) — verified by testing the exact
same API key from a plain machine (works) vs. from the deployed Worker
(blocked, consistently). So the actual Era API call happens in a scheduled
GitHub Actions job instead, which then pushes the result to Lana over a
small secured endpoint.

Setup:

1. Get an API key from Era (Settings → Developer/API in the Era dashboard).
2. Generate a random secret for `ERA_SYNC_SECRET` (same idea as `SESSION_SECRET`
   — used to authenticate the GitHub Action's requests to Lana, since it can't
   use your Google session cookie).
3. Set both as **Cloudflare Worker secrets**:
   ```bash
   npx wrangler secret put ERA_SYNC_SECRET
   ```
   (`ERA_API_KEY` does *not* need to be a Worker secret — the Worker itself
   never calls Era.)
4. Add three **GitHub repository secrets** (repo → Settings → Secrets and
   variables → Actions):

   | Secret | Value |
   |---|---|
   | `ERA_API_KEY` | Same key from step 1. |
   | `LANA_URL` | Your deployed URL, e.g. `https://lana.bmdahmen.workers.dev` |
   | `LANA_SYNC_SECRET` | Same value as `ERA_SYNC_SECRET` in step 3. |

5. `.github/workflows/era-sync.yml` runs every 6 hours automatically, and can
   also be triggered on demand from the repo's **Actions** tab (Run workflow).

Two things worth knowing:

- **Era's own plan limits can obfuscate balances.** If your Era plan caps
  visible accounts, some accounts come back with no balance data at all — the
  sync skips those rather than writing a false $0, so they simply won't appear
  until your Era plan shows real numbers for them.
- **Local `syncEraAccounts()` in `src/lib/era-sync.ts` won't work from the
  deployed Worker** — it's kept for completeness (and would work fine called
  from a non-Cloudflare environment), but production sync goes through
  `/api/era/ingest` fed by the GitHub Actions job, not a direct in-Worker call.

## Database

Schema lives in `migrations/*.sql`, applied in order. The Cloudflare D1 database
(`lana`) is already provisioned — its `database_id` is wired up in `wrangler.jsonc`.

- `npm run db:migrate:local` — apply migrations to your local Miniflare D1 (used by `next dev`).
- `npm run db:migrate:remote` — apply migrations to the production D1 database.

## Syncing transactions

- `/api/plaid/sync` (POST) walks every linked Plaid item and pulls new
  transactions + balances. Trigger it manually, or on a schedule (e.g. a Cloudflare
  Cron Trigger hitting this endpoint).
- If `PLAID_WEBHOOK_URL` is configured, Plaid calls `/api/plaid/webhook` whenever
  new transactions are ready, which syncs that item immediately.
- `/api/mx/sync` (POST) does the same for every MX-linked brokerage/bank member.
  MX pushes updates to `/api/mx/webhook` if you've registered one (see MX setup above).
- Era syncs on a schedule via GitHub Actions (see Era setup above), which POSTs
  to `/api/era/ingest`. Trigger it early from the repo's Actions tab if you
  don't want to wait for the next 6-hour run.

## Deploying to Cloudflare

```bash
npm run cf:deploy
```

This runs the OpenNext build (`opennextjs-cloudflare build`) and deploys the
resulting Worker (`opennextjs-cloudflare deploy`). Set secrets before your first
deploy:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_ALLOWED_EMAIL
npx wrangler secret put PLAID_CLIENT_ID
npx wrangler secret put PLAID_SECRET
npx wrangler secret put PLAID_ENV
npx wrangler secret put PLAID_WEBHOOK_URL
npx wrangler secret put MX_CLIENT_ID
npx wrangler secret put MX_API_KEY
npx wrangler secret put MX_ENV
npx wrangler secret put ERA_SYNC_SECRET
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is different: Next.js inlines `NEXT_PUBLIC_*`
variables into the compiled bundle at **build time**, not at Worker runtime — so
it won't work as a `wrangler secret` or a `wrangler.jsonc` var. Make sure it's
set in `.env.local` (or your shell) *before* running `npm run cf:deploy`, since
that's when `next build` actually runs and bakes the value in.

To preview the production build locally against real Cloudflare bindings:

```bash
npm run cf:preview
```

## Auto-deploy on push

This repo is connected to Cloudflare's native Git integration ("Workers
Builds"), under the Worker's **Settings → Builds** in the Cloudflare dashboard.
It watches `main` and builds + deploys on every push — no GitHub Actions
needed. Two settings matter there:

- **Build command** must be `npm run cf:build` — *not* `npm run build`. Plain
  `next build` only produces Next's own `.next` output; it's `npm run cf:build`
  (via the OpenNext adapter) that produces `.open-next/worker.js`, which is
  what `wrangler deploy` actually ships. Using the wrong command means the
  build either fails or deploys stale output.
- **Build environment variables** must include `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  (same value as your `.env.local`) — it's baked into the client bundle at
  build time, so it has to be present there, not just as a Worker secret.

Runtime secrets (`SESSION_SECRET`, `GOOGLE_ALLOWED_EMAIL`, `PLAID_CLIENT_ID`,
`PLAID_SECRET`, `PLAID_ENV`) stay exactly as set via `wrangler secret put` —
Cloudflare's builder reads those from the Worker itself, not from the build
environment.

Once both are set correctly, `git push` to `main` is the entire deploy
workflow — no manual `npm run cf:deploy` needed.

## Architecture notes

- **Auth**: Google sign-in only (no password) via Google Identity Services,
  restricted to `GOOGLE_ALLOWED_EMAIL`. The verified Google token creates a
  cookie-based session (`iron-session`). No multi-tenancy — this app is meant
  to be deployed for one person.
- **Data model**: `migrations/0001_init.sql` onward. Accounts carry both a Plaid
  `type`/`subtype` (when linked) and an `asset_class` (cash, brokerage,
  retirement, crypto, real_estate, hard_asset, liabilities, other) used for the
  net-worth-by-category chart.
- **Categorization**: transactions get a category from Plaid's
  `personal_finance_category`, mapped in `src/lib/categorize.ts`, or from
  user-defined rules (`category_rule` table) checked first. Manually recategorizing
  a transaction marks it `category_source = 'manual'` so future syncs won't
  overwrite it.
- **Net worth**: `account_balance_history` stores a daily balance snapshot per
  account (written on every sync); `net_worth_snapshot` stores the daily
  assets/liabilities/net-worth rollup. The dashboard's category breakdown is
  computed on the fly from `account_balance_history` grouped by `asset_class`.
