import { getPlaidClient } from "@/lib/plaid";
import { applyCategoryRules, defaultCategoryFor, isInvestmentAssetClass, type CategoryRule } from "@/lib/categorize";
import { newId } from "@/lib/db";
import { recomputeSpotPriceAccountBalances } from "@/lib/spot-price";
import { recomputeRealEstateAccountBalances } from "@/lib/zillow";
import { refreshNetWorthSeriesCache } from "@/lib/queries";

interface PlaidItemRow {
  id: string;
  access_token: string;
  cursor: string | null;
}

const RECOMPUTE_THROTTLE_MS = 4 * 60 * 60 * 1000;

async function isRecomputeStale(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT last_recomputed_at FROM recompute_state WHERE id = 1")
    .first<{ last_recomputed_at: number }>();
  return !row || Date.now() - row.last_recomputed_at > RECOMPUTE_THROTTLE_MS;
}

async function markRecomputed(db: D1Database): Promise<void> {
  await db
    .prepare(
      `INSERT INTO recompute_state (id, last_recomputed_at) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET last_recomputed_at = excluded.last_recomputed_at`
    )
    .bind(Date.now())
    .run();
}

/**
 * Re-syncs every connected Plaid item's transactions. Plaid continues to
 * backfill an Item's historical transactions asynchronously for a while
 * after it's first linked, delivering the older data as further "added"
 * entries on subsequent `/transactions/sync` calls -- but until now nothing
 * ever called this again outside of Plaid's own SYNC_UPDATES_AVAILABLE
 * webhook, so an item that finished backfilling more history than its
 * initial sync returned would never actually have it pulled in.
 */
export async function syncAllPlaidItems(db: D1Database): Promise<void> {
  const items = await db
    .prepare("SELECT id, access_token, cursor FROM plaid_item WHERE status = 'good'")
    .all<PlaidItemRow>();

  for (const item of items.results ?? []) {
    try {
      await syncPlaidItem(db, item);
    } catch {
      // Best-effort: one item's sync failure (e.g. a transient Plaid error)
      // shouldn't block the others or the balance recompute that follows.
    }
  }
}

/**
 * Refreshes Plaid transactions, metal, real-estate, and net-worth balances
 * together, at most once per throttle window. Called from the nightly cron
 * (api/cron/snapshot) and the manual-refresh API route
 * (api/net-worth/recompute), so the throttle guards against back-to-back
 * invocations re-running this whole pipeline (including sequential writes)
 * when nothing has changed since the last run.
 */
export async function recomputeAccountBalances(
  db: D1Database,
  options?: { force?: boolean }
): Promise<void> {
  if (!options?.force && !(await isRecomputeStale(db))) return;

  await syncAllPlaidItems(db);
  await Promise.all([recomputeSpotPriceAccountBalances(db), recomputeRealEstateAccountBalances(db)]);
  await recomputeNetWorth(db, { force: true });
}

function accountIsAsset(type: string): boolean {
  return type !== "credit" && type !== "loan";
}

/**
 * Pulls buy/sell/cash activity for an item's investment-type accounts via
 * Plaid's Investments product (`/investments/transactions/get`) -- separate
 * from, and never returned by, the regular Transactions product that
 * `syncPlaidItem` otherwise relies on. Requires the item to have granted
 * Investments consent (see EnableInvestmentsButton's update-mode Link flow);
 * until then, or while Plaid's async historical extraction is still running
 * right after that consent is granted, this call fails with PRODUCT_NOT_READY
 * and is skipped quietly -- there's nothing to do but retry on the next sync.
 */
const INVESTMENT_TRANSACTIONS_LOOKBACK_DAYS = 730;
const INVESTMENT_TRANSACTIONS_PAGE_SIZE = 500;
const BATCH_SIZE = 50;

export async function syncInvestmentTransactions(db: D1Database, item: PlaidItemRow): Promise<void> {
  const investmentAccounts = await db
    .prepare("SELECT id, plaid_account_id FROM account WHERE plaid_item_id = ? AND type = 'investment'")
    .bind(item.id)
    .all<{ id: string; plaid_account_id: string }>();
  const accountByPlaidId = new Map(
    (investmentAccounts.results ?? []).map((row) => [row.plaid_account_id, row.id])
  );
  if (accountByPlaidId.size === 0) return;

  const plaid = getPlaidClient();
  const today = new Date().toISOString().slice(0, 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - INVESTMENT_TRANSACTIONS_LOOKBACK_DAYS);
  const start = startDate.toISOString().slice(0, 10);

  const securityNames = new Map<string, string>();
  const rows: Array<{
    plaidId: string;
    accountId: string;
    securityId: string | null;
    date: string;
    name: string;
    amount: number;
    quantity: number | null;
    price: number | null;
    fees: number | null;
    type: string;
    subtype: string;
    isoCurrencyCode: string | null;
  }> = [];

  let offset = 0;
  let total = Infinity;
  try {
    while (offset < total) {
      const response = await plaid.investmentsTransactionsGet({
        access_token: item.access_token,
        start_date: start,
        end_date: today,
        options: { count: INVESTMENT_TRANSACTIONS_PAGE_SIZE, offset },
      });

      for (const security of response.data.securities) {
        if (security.name) securityNames.set(security.security_id, security.name);
      }
      for (const tx of response.data.investment_transactions) {
        const accountId = accountByPlaidId.get(tx.account_id);
        if (!accountId) continue;
        rows.push({
          plaidId: tx.investment_transaction_id,
          accountId,
          securityId: tx.security_id,
          date: tx.date,
          name: tx.name,
          amount: tx.amount,
          quantity: tx.quantity ?? null,
          price: tx.price ?? null,
          fees: tx.fees ?? null,
          type: tx.type,
          subtype: tx.subtype,
          isoCurrencyCode: tx.iso_currency_code,
        });
      }

      total = response.data.total_investment_transactions;
      const pageLength = response.data.investment_transactions.length;
      if (pageLength === 0) break;
      offset += pageLength;
    }
  } catch {
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await db.batch(
      chunk.map((row) =>
        db
          .prepare(
            `INSERT INTO investment_transaction (
               id, plaid_investment_transaction_id, account_id, security_name, date, name,
               amount, quantity, price, fees, type, subtype, iso_currency_code
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(plaid_investment_transaction_id) DO UPDATE SET
               security_name = excluded.security_name,
               date = excluded.date,
               name = excluded.name,
               amount = excluded.amount,
               quantity = excluded.quantity,
               price = excluded.price,
               fees = excluded.fees,
               type = excluded.type,
               subtype = excluded.subtype,
               updated_at = datetime('now')`
          )
          .bind(
            newId("itx"),
            row.plaidId,
            row.accountId,
            row.securityId ? securityNames.get(row.securityId) ?? null : null,
            row.date,
            row.name,
            row.amount,
            row.quantity,
            row.price,
            row.fees,
            row.type,
            row.subtype,
            row.isoCurrencyCode ?? "USD"
          )
      )
    );
  }
}

export async function syncPlaidItem(db: D1Database, item: PlaidItemRow): Promise<void> {
  const plaid = getPlaidClient();

  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  const added: Array<Awaited<ReturnType<typeof plaid.transactionsSync>>["data"]["added"][number]> = [];
  const modified: typeof added = [];
  const removed: Array<{ transaction_id: string }> = [];

  while (hasMore) {
    const response = await plaid.transactionsSync({
      access_token: item.access_token,
      cursor,
    });
    added.push(...response.data.added);
    modified.push(...response.data.modified);
    removed.push(...response.data.removed);
    hasMore = response.data.has_more;
    cursor = response.data.next_cursor;
  }

  const accountRows = await db
    .prepare("SELECT id, plaid_account_id, asset_class FROM account WHERE plaid_item_id = ?")
    .bind(item.id)
    .all<{ id: string; plaid_account_id: string; asset_class: string }>();
  const accountByPlaidId = new Map(
    (accountRows.results ?? []).map((row) => [row.plaid_account_id, row])
  );

  const rulesResult = await db
    .prepare(
      "SELECT match_field, match_type, match_value, category_id FROM category_rule ORDER BY priority DESC"
    )
    .all<CategoryRule>();
  const rules = rulesResult.results ?? [];

  for (const tx of [...added, ...modified]) {
    const account = accountByPlaidId.get(tx.account_id);
    if (!account) continue;
    const accountId = account.id;

    const ruleMatch = applyCategoryRules(rules, {
      name: tx.name,
      merchant_name: tx.merchant_name ?? null,
    });
    const categoryId = isInvestmentAssetClass(account.asset_class)
      ? "cat_transfer"
      : ruleMatch ??
        defaultCategoryFor(
          tx.personal_finance_category?.primary,
          tx.personal_finance_category?.detailed
        );

    await db
      .prepare(
        `INSERT INTO "transaction" (
           id, plaid_transaction_id, account_id, amount, iso_currency_code, date,
           authorized_date, name, merchant_name, category_id, plaid_category,
           pending, is_manual, category_source
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'auto')
         ON CONFLICT(plaid_transaction_id) DO UPDATE SET
           amount = excluded.amount,
           date = excluded.date,
           authorized_date = excluded.authorized_date,
           name = excluded.name,
           merchant_name = excluded.merchant_name,
           category_id = CASE WHEN "transaction".category_source = 'manual'
                          THEN "transaction".category_id ELSE excluded.category_id END,
           plaid_category = excluded.plaid_category,
           pending = excluded.pending,
           updated_at = datetime('now')`
      )
      .bind(
        newId("txn"),
        tx.transaction_id,
        accountId,
        tx.amount,
        tx.iso_currency_code,
        tx.date,
        tx.authorized_date ?? null,
        tx.name,
        tx.merchant_name ?? null,
        categoryId,
        tx.personal_finance_category?.primary ?? null,
        tx.pending ? 1 : 0
      )
      .run();
  }

  for (const tx of removed) {
    await db
      .prepare('DELETE FROM "transaction" WHERE plaid_transaction_id = ?')
      .bind(tx.transaction_id)
      .run();
  }

  await db
    .prepare("UPDATE plaid_item SET cursor = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(cursor ?? null, item.id)
    .run();

  const accountsResponse = await plaid.accountsGet({ access_token: item.access_token });
  for (const acc of accountsResponse.data.accounts) {
    await db
      .prepare(
        `UPDATE account SET current_balance = ?, available_balance = ?, updated_at = datetime('now')
         WHERE plaid_account_id = ?`
      )
      .bind(acc.balances.current ?? null, acc.balances.available ?? null, acc.account_id)
      .run();
  }

  await syncInvestmentTransactions(db, item);
  await recomputeNetWorth(db, { force: true });
}

export async function recomputeNetWorth(
  db: D1Database,
  options?: { force?: boolean }
): Promise<void> {
  if (!options?.force && !(await isRecomputeStale(db))) return;

  const today = new Date().toISOString().slice(0, 10);

  const accounts = await db
    .prepare(
      `SELECT id, current_balance, is_asset FROM account
       WHERE is_closed = 0 AND is_hidden = 0
         AND (relevant_until IS NULL OR relevant_until >= ?)`
    )
    .bind(today)
    .all<{ id: string; current_balance: number | null; is_asset: number }>();

  let totalAssets = 0;
  let totalLiabilities = 0;
  const statements = [];

  for (const acc of accounts.results ?? []) {
    const balance = acc.current_balance ?? 0;
    if (acc.is_asset) {
      totalAssets += balance;
    } else {
      totalLiabilities += balance;
    }

    statements.push(
      db
        .prepare(
          `INSERT INTO account_balance_history (id, account_id, date, current_balance)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id, date) DO UPDATE SET current_balance = excluded.current_balance`
        )
        .bind(newId("bal"), acc.id, today, balance)
    );
  }

  const netWorth = totalAssets - totalLiabilities;

  statements.push(
    db
      .prepare(
        `INSERT INTO net_worth_snapshot (id, date, total_assets, total_liabilities, net_worth)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           total_assets = excluded.total_assets,
           total_liabilities = excluded.total_liabilities,
           net_worth = excluded.net_worth`
      )
      .bind(newId("nws"), today, totalAssets, totalLiabilities, netWorth)
  );

  await db.batch(statements);
  await markRecomputed(db);

  // Balances just changed -- refresh the cached series in the background so
  // the next page load / range switch reads it instantly instead of
  // re-running the aggregation query.
  await refreshNetWorthSeriesCache(db);
}

export { accountIsAsset };
