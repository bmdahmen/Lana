import { newId } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { recomputeSpotPriceAccountBalances } from "@/lib/spot-price";
import { recomputeNetWorth } from "@/lib/sync";
import type { PreciousMetal } from "@/lib/asset-classes";

export const METAL_ITEM_CATEGORIES = [
  { id: "bullion_coin", label: "Government" },
  { id: "bullion_bar_round", label: "Bars & rounds" },
  { id: "junk_silver", label: "Junk silver" },
  { id: "numismatic", label: "Numismatic" },
  { id: "other", label: "Other" },
] as const;

export type MetalItemCategory = (typeof METAL_ITEM_CATEGORIES)[number]["id"];

export function categoryLabel(category: string): string {
  return METAL_ITEM_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

export interface MetalItem {
  id: string;
  metal: PreciousMetal;
  category: MetalItemCategory;
  name: string;
  mint: string | null;
  year: number | null;
  condition: string | null;
  quantity: number;
  troy_oz_each: number;
  face_value_each: number | null;
  purchase_price_total: number | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetalItemFilters {
  metal?: PreciousMetal;
  category?: MetalItemCategory;
  q?: string;
}

export async function getMetalItems(db: D1Database, filters: MetalItemFilters = {}): Promise<MetalItem[]> {
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (filters.metal) {
    clauses.push("metal = ?");
    bindings.push(filters.metal);
  }
  if (filters.category) {
    clauses.push("category = ?");
    bindings.push(filters.category);
  }
  if (filters.q) {
    clauses.push("(name LIKE ? OR mint LIKE ?)");
    const like = `%${filters.q}%`;
    bindings.push(like, like);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db
    .prepare(
      `SELECT * FROM metal_item ${where}
       ORDER BY metal ASC, troy_oz_each * quantity DESC, name ASC`
    )
    .bind(...bindings)
    .all<MetalItem>();
  return result.results ?? [];
}

export interface MetalCategorySummary {
  category: MetalItemCategory;
  troyOz: number;
  itemCount: number;
  value: number;
}

export interface MetalCollectionSummary {
  troyOz: Record<PreciousMetal, number>;
  value: Record<PreciousMetal, number>;
  itemCount: Record<PreciousMetal, number>;
  costBasis: Record<PreciousMetal, number>;
  byCategory: Record<PreciousMetal, MetalCategorySummary[]>;
}

export async function getMetalCollectionSummary(
  db: D1Database,
  prices: Record<PreciousMetal, number>
): Promise<MetalCollectionSummary> {
  const items = await getMetalItems(db);

  const troyOz: Record<PreciousMetal, number> = { gold: 0, silver: 0 };
  const itemCount: Record<PreciousMetal, number> = { gold: 0, silver: 0 };
  const costBasis: Record<PreciousMetal, number> = { gold: 0, silver: 0 };
  const byCategoryMap: Record<PreciousMetal, Map<MetalItemCategory, { troyOz: number; itemCount: number }>> = {
    gold: new Map(),
    silver: new Map(),
  };

  for (const item of items) {
    const oz = item.quantity * item.troy_oz_each;
    troyOz[item.metal] += oz;
    itemCount[item.metal] += 1;
    costBasis[item.metal] += item.purchase_price_total ?? 0;

    const bucket = byCategoryMap[item.metal].get(item.category) ?? { troyOz: 0, itemCount: 0 };
    bucket.troyOz += oz;
    bucket.itemCount += 1;
    byCategoryMap[item.metal].set(item.category, bucket);
  }

  const value: Record<PreciousMetal, number> = {
    gold: troyOz.gold * prices.gold,
    silver: troyOz.silver * prices.silver,
  };

  const byCategory: Record<PreciousMetal, MetalCategorySummary[]> = {
    gold: [...byCategoryMap.gold.entries()]
      .map(([category, agg]) => ({ category, troyOz: agg.troyOz, itemCount: agg.itemCount, value: agg.troyOz * prices.gold }))
      .sort((a, b) => b.value - a.value),
    silver: [...byCategoryMap.silver.entries()]
      .map(([category, agg]) => ({ category, troyOz: agg.troyOz, itemCount: agg.itemCount, value: agg.troyOz * prices.silver }))
      .sort((a, b) => b.value - a.value),
  };

  return { troyOz, value, itemCount, costBasis, byCategory };
}

/**
 * Keeps the lump-sum "Precious Metals" manual account(s) that drive net
 * worth (added in migration 0009, one per metal) in sync with the sum of
 * metal_item -- reuses whichever account the user already has for a metal
 * (from the old "Add manual account" flow) rather than creating a
 * duplicate, since two accounts of the same metal would double-count net
 * worth. Creates one only if none exists yet.
 */
export async function syncMetalCollectionAccounts(db: D1Database): Promise<void> {
  const totals = await db
    .prepare("SELECT metal, SUM(quantity * troy_oz_each) as troy_oz FROM metal_item GROUP BY metal")
    .all<{ metal: PreciousMetal; troy_oz: number }>();
  const byMetal = new Map((totals.results ?? []).map((r) => [r.metal, r.troy_oz]));

  for (const metal of ["gold", "silver"] as const) {
    const troyOz = byMetal.get(metal) ?? 0;
    const existing = await db
      .prepare(
        "SELECT id FROM account WHERE precious_metal = ? AND is_closed = 0 ORDER BY created_at ASC LIMIT 1"
      )
      .bind(metal)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare("UPDATE account SET metal_troy_oz = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(troyOz, existing.id)
        .run();
    } else if (troyOz > 0) {
      await db
        .prepare(
          `INSERT INTO account (id, name, type, current_balance, is_manual, is_asset, asset_class, precious_metal, metal_troy_oz)
           VALUES (?, ?, 'other', 0, 1, 1, 'precious_metals', ?, ?)`
        )
        .bind(newId("acct"), metal === "gold" ? "Gold" : "Silver", metal, troyOz)
        .run();
    }
  }

  await recomputeSpotPriceAccountBalances(db);
  await recomputeNetWorth(db, { force: true });
  await invalidateCache(CACHE_KEYS.accountsList, CACHE_KEYS.homeDashboard);
}

/** account_balance_history for the gold/silver manual account(s), pivoted
 *  into {date, gold, silver} points for the collection value chart --
 *  reuses the same daily snapshots that already drive the net worth chart. */
export interface MetalValuePoint {
  date: string;
  gold: number;
  silver: number;
}

export async function getMetalValueHistory(db: D1Database): Promise<MetalValuePoint[]> {
  const result = await db
    .prepare(
      `SELECT abh.date, a.precious_metal as metal, SUM(abh.current_balance) as total
       FROM account_balance_history abh
       JOIN account a ON a.id = abh.account_id
       WHERE a.precious_metal IS NOT NULL AND a.is_closed = 0
       GROUP BY abh.date, a.precious_metal
       ORDER BY abh.date ASC`
    )
    .all<{ date: string; metal: PreciousMetal; total: number }>();

  const byDate = new Map<string, { gold: number; silver: number }>();
  for (const row of result.results ?? []) {
    const bucket = byDate.get(row.date) ?? { gold: 0, silver: 0 };
    bucket[row.metal] = row.total;
    byDate.set(row.date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, gold: v.gold, silver: v.silver }));
}
