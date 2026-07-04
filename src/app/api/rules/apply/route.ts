import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { applyCategoryRules, type CategoryRule } from "@/lib/categorize";

const BATCH_SIZE = 50;

/** Re-runs all category rules against existing transactions, so a newly created
 *  or edited rule can also fix transactions that were already categorized
 *  before the rule existed. Manually-recategorized transactions are left alone. */
export async function POST() {
  const db = await getDB();

  const rulesResult = await db
    .prepare(
      "SELECT match_field, match_type, match_value, category_id FROM category_rule ORDER BY priority DESC"
    )
    .all<CategoryRule>();
  const rules = rulesResult.results ?? [];

  if (rules.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const txResult = await db
    .prepare(
      `SELECT id, name, merchant_name, category_id FROM "transaction" WHERE category_source = 'auto'`
    )
    .all<{ id: string; name: string; merchant_name: string | null; category_id: string | null }>();
  const transactions = txResult.results ?? [];

  const updates: Array<{ id: string; categoryId: string }> = [];
  for (const tx of transactions) {
    const categoryId = applyCategoryRules(rules, tx);
    if (categoryId !== null && categoryId !== tx.category_id) {
      updates.push({ id: tx.id, categoryId });
    }
  }

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await db.batch(
      chunk.map((u) =>
        db
          .prepare(
            `UPDATE "transaction" SET category_id = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .bind(u.categoryId, u.id)
      )
    );
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}
