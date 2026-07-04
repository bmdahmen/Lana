import type { PreciousMetal } from "@/lib/asset-classes";

const SPOT_PRICE_MAX_AGE_MS = 60 * 60 * 1000;

const SYMBOL: Record<PreciousMetal, "XAU" | "XAG"> = { gold: "XAU", silver: "XAG" };

async function fetchSpotPrice(metal: PreciousMetal): Promise<number> {
  const res = await fetch(`https://api.gold-api.com/price/${SYMBOL[metal]}`);
  if (!res.ok) {
    throw new Error(`Spot price fetch failed for ${metal}: ${res.status}`);
  }
  const data = (await res.json()) as { price: number };
  return data.price;
}

/** Prices are USD per troy ounce, cached in D1 and refreshed at most once an hour. */
export async function getSpotPrices(db: D1Database): Promise<Record<PreciousMetal, number>> {
  const rows = await db
    .prepare("SELECT metal, price_usd, updated_at FROM spot_price")
    .all<{ metal: PreciousMetal; price_usd: number; updated_at: number }>();
  const cached = new Map((rows.results ?? []).map((r) => [r.metal, r]));

  const now = Date.now();
  const isStale = (metal: PreciousMetal) => {
    const row = cached.get(metal);
    return !row || now - row.updated_at > SPOT_PRICE_MAX_AGE_MS;
  };

  if (isStale("gold") || isStale("silver")) {
    try {
      const [gold, silver] = await Promise.all([fetchSpotPrice("gold"), fetchSpotPrice("silver")]);
      await db.batch([
        db
          .prepare(
            `INSERT INTO spot_price (metal, price_usd, updated_at) VALUES ('gold', ?, ?)
             ON CONFLICT(metal) DO UPDATE SET price_usd = excluded.price_usd, updated_at = excluded.updated_at`
          )
          .bind(gold, now),
        db
          .prepare(
            `INSERT INTO spot_price (metal, price_usd, updated_at) VALUES ('silver', ?, ?)
             ON CONFLICT(metal) DO UPDATE SET price_usd = excluded.price_usd, updated_at = excluded.updated_at`
          )
          .bind(silver, now),
      ]);
      return { gold, silver };
    } catch (error) {
      console.error("Failed to refresh spot prices, falling back to cache", (error as Error).message);
      const gold = cached.get("gold");
      const silver = cached.get("silver");
      if (!gold || !silver) throw error;
      return { gold: gold.price_usd, silver: silver.price_usd };
    }
  }

  return { gold: cached.get("gold")!.price_usd, silver: cached.get("silver")!.price_usd };
}

export async function recomputeMetalAccountBalances(db: D1Database): Promise<void> {
  const hasMetalAccounts = await db
    .prepare("SELECT 1 FROM account WHERE precious_metal IS NOT NULL AND is_closed = 0 LIMIT 1")
    .first();
  if (!hasMetalAccounts) return;

  const prices = await getSpotPrices(db);

  await db.batch([
    db
      .prepare(
        `UPDATE account SET current_balance = metal_troy_oz * ?, updated_at = datetime('now')
         WHERE precious_metal = 'gold' AND is_closed = 0`
      )
      .bind(prices.gold),
    db
      .prepare(
        `UPDATE account SET current_balance = metal_troy_oz * ?, updated_at = datetime('now')
         WHERE precious_metal = 'silver' AND is_closed = 0`
      )
      .bind(prices.silver),
  ]);
}
