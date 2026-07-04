import { listEraAccounts, listEraTransactions, type EraAccount, type EraTransaction } from "@/lib/era";
import { applyCategoryRules, defaultCategoryFromLabel, type CategoryRule } from "@/lib/categorize";
import { newId } from "@/lib/db";
import { deriveEraAssetClass, isAssetClassLiability } from "@/lib/asset-classes";
import { recomputeNetWorth } from "@/lib/sync";

export async function applyEraAccounts(
  db: D1Database,
  eraAccounts: EraAccount[]
): Promise<{ synced: number; skipped: number }> {
  let synced = 0;
  let skipped = 0;

  for (const eraAcc of eraAccounts) {
    if (eraAcc.balance.current === undefined) {
      // Obfuscated by Era's own plan limits — skip rather than sync a false zero.
      skipped++;
      continue;
    }

    const assetClass = deriveEraAssetClass(eraAcc.type, eraAcc.name);
    const existing = await db
      .prepare("SELECT id FROM account WHERE era_account_group_key = ?")
      .bind(eraAcc.account_group_key)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(
          `UPDATE account SET current_balance = ?, available_balance = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(eraAcc.balance.current, eraAcc.balance.available ?? null, existing.id)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO account (
             id, era_account_group_key, name, type, current_balance, available_balance,
             iso_currency_code, is_asset, asset_class
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          newId("acct"),
          eraAcc.account_group_key,
          eraAcc.name,
          eraAcc.type,
          eraAcc.balance.current,
          eraAcc.balance.available ?? null,
          eraAcc.balance.currency,
          isAssetClassLiability(assetClass) ? 0 : 1,
          assetClass
        )
        .run();
    }
    synced++;
  }

  return { synced, skipped };
}

export async function applyEraTransactions(
  db: D1Database,
  transactions: EraTransaction[]
): Promise<{ applied: number }> {
  const rulesResult = await db
    .prepare(
      "SELECT match_field, match_type, match_value, category_id FROM category_rule ORDER BY priority DESC"
    )
    .all<CategoryRule>();
  const rules = rulesResult.results ?? [];

  const accountRows = await db
    .prepare("SELECT id, era_account_group_key FROM account WHERE era_account_group_key IS NOT NULL")
    .all<{ id: string; era_account_group_key: string }>();
  const accountIdByGroupKey = new Map(
    (accountRows.results ?? []).map((row) => [row.era_account_group_key, row.id])
  );

  let applied = 0;

  for (const tx of transactions) {
    const accountId = accountIdByGroupKey.get(tx.account_group_key);
    if (!accountId) continue;

    const signedAmount = tx.is_cash_outflow ? Math.abs(tx.amount) : -Math.abs(tx.amount);

    const ruleMatch = applyCategoryRules(rules, {
      name: tx.description,
      merchant_name: tx.merchant_name ?? null,
    });
    const categoryId = ruleMatch ?? defaultCategoryFromLabel(tx.category);

    await db
      .prepare(
        `INSERT INTO "transaction" (
           id, era_transaction_id, account_id, amount, iso_currency_code, date,
           name, merchant_name, category_id, pending, is_manual, category_source
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'auto')
         ON CONFLICT(era_transaction_id) DO UPDATE SET
           amount = excluded.amount,
           date = excluded.date,
           name = excluded.name,
           merchant_name = excluded.merchant_name,
           category_id = CASE WHEN "transaction".category_source = 'manual'
                          THEN "transaction".category_id ELSE excluded.category_id END,
           pending = excluded.pending,
           updated_at = datetime('now')`
      )
      .bind(
        newId("txn"),
        tx.transaction_id,
        accountId,
        signedAmount,
        tx.currency,
        tx.posted_date,
        tx.description,
        tx.merchant_name ?? null,
        categoryId,
        tx.is_pending ? 1 : 0
      )
      .run();

    applied++;
  }

  return { applied };
}

/**
 * Fetches from Era and applies in one call. Only works when the caller's
 * network egress isn't Cloudflare's (Era's WAF blocks Cloudflare Workers
 * traffic) — not usable from within this app's own deployed Worker. Kept for
 * completeness / non-Workers callers; production sync goes through the
 * GitHub Actions job hitting /api/era/ingest instead.
 */
export async function syncEraAccounts(db: D1Database): Promise<{ synced: number; skipped: number }> {
  const eraAccounts = await listEraAccounts();
  const accountResult = await applyEraAccounts(db, eraAccounts);

  const accountRows = await db
    .prepare("SELECT era_account_group_key FROM account WHERE era_account_group_key IS NOT NULL")
    .all<{ era_account_group_key: string }>();

  const transactions: EraTransaction[] = [];
  for (const row of accountRows.results ?? []) {
    transactions.push(...(await listEraTransactions(row.era_account_group_key)));
  }
  await applyEraTransactions(db, transactions);

  await recomputeNetWorth(db);

  return accountResult;
}
