import { getPlaidClient } from "@/lib/plaid";
import { applyCategoryRules, defaultCategoryFor, type CategoryRule } from "@/lib/categorize";
import { newId } from "@/lib/db";

interface PlaidItemRow {
  id: string;
  access_token: string;
  cursor: string | null;
}

function accountIsAsset(type: string): boolean {
  return type !== "credit" && type !== "loan";
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
    .prepare("SELECT id, plaid_account_id FROM account WHERE plaid_item_id = ?")
    .bind(item.id)
    .all<{ id: string; plaid_account_id: string }>();
  const accountIdByPlaidId = new Map(
    (accountRows.results ?? []).map((row) => [row.plaid_account_id, row.id])
  );

  const rulesResult = await db
    .prepare(
      "SELECT match_field, match_type, match_value, category_id FROM category_rule ORDER BY priority DESC"
    )
    .all<CategoryRule>();
  const rules = rulesResult.results ?? [];

  for (const tx of [...added, ...modified]) {
    const accountId = accountIdByPlaidId.get(tx.account_id);
    if (!accountId) continue;

    const ruleMatch = applyCategoryRules(rules, {
      name: tx.name,
      merchant_name: tx.merchant_name ?? null,
    });
    const categoryId =
      ruleMatch ??
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

  await recomputeNetWorth(db);
}

export async function recomputeNetWorth(db: D1Database): Promise<void> {
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

  for (const acc of accounts.results ?? []) {
    const balance = acc.current_balance ?? 0;
    if (acc.is_asset) {
      totalAssets += balance;
    } else {
      totalLiabilities += balance;
    }

    await db
      .prepare(
        `INSERT INTO account_balance_history (id, account_id, date, current_balance)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(account_id, date) DO UPDATE SET current_balance = excluded.current_balance`
      )
      .bind(newId("bal"), acc.id, today, balance)
      .run();
  }

  const netWorth = totalAssets - totalLiabilities;

  await db
    .prepare(
      `INSERT INTO net_worth_snapshot (id, date, total_assets, total_liabilities, net_worth)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         total_assets = excluded.total_assets,
         total_liabilities = excluded.total_liabilities,
         net_worth = excluded.net_worth`
    )
    .bind(newId("nws"), today, totalAssets, totalLiabilities, netWorth)
    .run();
}

export { accountIsAsset };
