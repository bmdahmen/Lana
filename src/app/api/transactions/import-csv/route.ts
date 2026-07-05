import { NextResponse } from "next/server";
import { getDB, newId } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { parseTransactionsFromCsv } from "@/lib/csv-import";
import {
  applyCategoryRules,
  defaultCategoryFromLabel,
  isBrokerageAssetClass,
  type CategoryRule,
} from "@/lib/categorize";
import { recomputeNetWorth } from "@/lib/sync";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const accountId = formData.get("accountId");
  const flipSign = formData.get("flipSign") === "true";

  if (!(file instanceof File) || typeof accountId !== "string" || !accountId) {
    return NextResponse.json({ error: "Missing file or accountId" }, { status: 400 });
  }

  const db = await getDB();
  const account = await db
    .prepare("SELECT id, asset_class FROM account WHERE id = ?")
    .bind(accountId)
    .first<{ id: string; asset_class: string }>();
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const text = await file.text();

  let parsed;
  try {
    parsed = parseTransactionsFromCsv(text, flipSign);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const rulesResult = await db
    .prepare(
      "SELECT match_field, match_type, match_value, category_id FROM category_rule ORDER BY priority DESC"
    )
    .all<CategoryRule>();
  const rules = rulesResult.results ?? [];

  let imported = 0;
  let skipped = 0;

  for (const tx of parsed) {
    const importHash = `${accountId}|${tx.date}|${tx.description}|${tx.amount}`;

    const ruleMatch = applyCategoryRules(rules, { name: tx.description, merchant_name: null });
    const categoryId = isBrokerageAssetClass(account.asset_class)
      ? "cat_transfer"
      : ruleMatch ?? defaultCategoryFromLabel(tx.category);

    const result = await db
      .prepare(
        `INSERT INTO "transaction" (
           id, account_id, amount, date, name, category_id, is_manual, category_source, import_hash
         ) VALUES (?, ?, ?, ?, ?, ?, 1, 'auto', ?)
         ON CONFLICT(import_hash) DO NOTHING`
      )
      .bind(newId("txn"), accountId, tx.amount, tx.date, tx.description, categoryId, importHash)
      .run();

    if (result.meta.changes > 0) {
      imported++;
    } else {
      skipped++;
    }
  }

  await recomputeNetWorth(db, { force: true });
  await invalidateCache(
    CACHE_KEYS.transactionsDefault,
    CACHE_KEYS.accountsList,
    CACHE_KEYS.homeDashboard
  );

  return NextResponse.json({ ok: true, imported, skipped });
}
