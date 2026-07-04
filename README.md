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

   Open http://localhost:3000 — you'll be prompted to create your account on
   first visit (single-user app, no invite/signup flow beyond that).

## Environment variables

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Random string, 32+ characters, used to encrypt the session cookie. Generate with `openssl rand -base64 32`. |
| `PLAID_CLIENT_ID` | From the [Plaid dashboard](https://dashboard.plaid.com/team-settings/keys). |
| `PLAID_SECRET` | Matching secret for your `PLAID_ENV` (sandbox/development/production). |
| `PLAID_ENV` | `sandbox`, `development`, or `production`. |
| `PLAID_WEBHOOK_URL` | Optional. Your deployed URL + `/api/plaid/webhook`, so Plaid can push transaction updates instead of relying on manual sync. |

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

## Deploying to Cloudflare

```bash
npm run cf:deploy
```

This runs the OpenNext build (`opennextjs-cloudflare build`) and deploys the
resulting Worker (`opennextjs-cloudflare deploy`). Set secrets before your first
deploy:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put PLAID_CLIENT_ID
npx wrangler secret put PLAID_SECRET
npx wrangler secret put PLAID_ENV
npx wrangler secret put PLAID_WEBHOOK_URL
```

To preview the production build locally against real Cloudflare bindings:

```bash
npm run cf:preview
```

## Architecture notes

- **Auth**: single-user, cookie-based session (`iron-session`), password hashed
  with PBKDF2 (Web Crypto). No multi-tenancy — this app is meant to be deployed
  for one person.
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
