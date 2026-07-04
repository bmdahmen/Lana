import { listMemberAccounts, listMemberTransactions } from "@/lib/mx";
import { applyCategoryRules, defaultCategoryFromLabel, type CategoryRule } from "@/lib/categorize";
import { newId } from "@/lib/db";
import { recomputeNetWorth } from "@/lib/sync";

interface MxMemberRow {
  id: string;
  mx_member_guid: string;
}

export async function syncMxMember(
  db: D1Database,
  mxUserGuid: string,
  member: MxMemberRow
): Promise<void> {
  const accounts = await listMemberAccounts(mxUserGuid, member.mx_member_guid);

  for (const acc of accounts) {
    await db
      .prepare(
        `UPDATE account SET current_balance = ?, available_balance = ?, updated_at = datetime('now')
         WHERE mx_account_guid = ?`
      )
      .bind(acc.balance, acc.available_balance, acc.guid)
      .run();
  }

  const accountRows = await db
    .prepare("SELECT id, mx_account_guid FROM account WHERE mx_member_id = ?")
    .bind(member.id)
    .all<{ id: string; mx_account_guid: string }>();
  const accountIdByMxGuid = new Map(
    (accountRows.results ?? []).map((row) => [row.mx_account_guid, row.id])
  );

  const rulesResult = await db
    .prepare(
      "SELECT match_field, match_type, match_value, category_id FROM category_rule ORDER BY priority DESC"
    )
    .all<CategoryRule>();
  const rules = rulesResult.results ?? [];

  const transactions = await listMemberTransactions(mxUserGuid, member.mx_member_guid);

  for (const tx of transactions) {
    const accountId = accountIdByMxGuid.get(tx.account_guid);
    if (!accountId) continue;

    const signedAmount = tx.type === "DEBIT" ? Math.abs(tx.amount) : -Math.abs(tx.amount);

    const ruleMatch = applyCategoryRules(rules, {
      name: tx.description,
      merchant_name: null,
    });
    const categoryId = ruleMatch ?? defaultCategoryFromLabel(tx.category);

    await db
      .prepare(
        `INSERT INTO "transaction" (
           id, mx_transaction_guid, account_id, amount, iso_currency_code, date,
           name, category_id, pending, is_manual, category_source
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'auto')
         ON CONFLICT(mx_transaction_guid) DO UPDATE SET
           amount = excluded.amount,
           date = excluded.date,
           name = excluded.name,
           category_id = CASE WHEN "transaction".category_source = 'manual'
                          THEN "transaction".category_id ELSE excluded.category_id END,
           pending = excluded.pending,
           updated_at = datetime('now')`
      )
      .bind(
        newId("txn"),
        tx.guid,
        accountId,
        signedAmount,
        tx.currency_code ?? "USD",
        tx.date,
        tx.description,
        categoryId,
        tx.status === "PENDING" ? 1 : 0
      )
      .run();
  }

  await db
    .prepare("UPDATE mx_member SET status = 'good', updated_at = datetime('now') WHERE id = ?")
    .bind(member.id)
    .run();

  await recomputeNetWorth(db, { force: true });
}
