import { ASSET_CLASSES, type AssetClass } from "@/lib/asset-classes";
import type { NetWorthByClassPoint } from "@/lib/net-worth-range";

export type { NetWorthByClassPoint };

/**
 * Returns the full (since-inception) net-worth-by-class series, backed by a
 * per-day cache so repeated page loads and range switches don't re-run this
 * join/aggregation on every request. The cache is refreshed by
 * `refreshNetWorthSeriesCache`, called from `recomputeNetWorth` whenever
 * balances actually change (see lib/sync.ts).
 */
export async function getNetWorthSeries(db: D1Database): Promise<NetWorthByClassPoint[]> {
  const cached = await db
    .prepare("SELECT payload FROM net_worth_series_cache WHERE id = 1")
    .first<{ payload: string }>();

  if (cached) {
    try {
      return JSON.parse(cached.payload) as NetWorthByClassPoint[];
    } catch {
      // Corrupt cache row -- fall through and recompute.
    }
  }

  return refreshNetWorthSeriesCache(db);
}

export async function refreshNetWorthSeriesCache(
  db: D1Database
): Promise<NetWorthByClassPoint[]> {
  const series = await computeNetWorthSeries(db);

  await db
    .prepare(
      `INSERT INTO net_worth_series_cache (id, payload, computed_at)
       VALUES (1, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, computed_at = excluded.computed_at`
    )
    .bind(JSON.stringify(series))
    .run();

  return series;
}

async function computeNetWorthSeries(db: D1Database): Promise<NetWorthByClassPoint[]> {
  const result = await db
    .prepare(
      `SELECT abh.date, a.asset_class, SUM(abh.current_balance) as total
       FROM account_balance_history abh
       JOIN account a ON a.id = abh.account_id
       WHERE a.is_closed = 0 AND a.is_hidden = 0
         AND (a.relevant_until IS NULL OR abh.date <= a.relevant_until)
       GROUP BY abh.date, a.asset_class
       ORDER BY abh.date ASC`
    )
    .all<{ date: string; asset_class: AssetClass; total: number }>();

  // A class stops getting new rows once every account that ever contributed
  // to it has passed its relevant_until with nothing open-ended left behind
  // (e.g. a relevancy-windowed account with no live replacement). Track the
  // latest such expiry per class so the carry-forward below can drop the
  // value to zero there instead of repeating a stale balance forever.
  const expiryResult = await db
    .prepare(
      `SELECT asset_class,
              MAX(relevant_until) as expires_at,
              SUM(CASE WHEN relevant_until IS NULL THEN 1 ELSE 0 END) as open_ended_count
       FROM account
       WHERE is_closed = 0 AND is_hidden = 0
       GROUP BY asset_class`
    )
    .all<{ asset_class: AssetClass; expires_at: string | null; open_ended_count: number }>();
  const classExpiry = new Map<string, string | null>();
  for (const row of expiryResult.results ?? []) {
    classExpiry.set(row.asset_class, row.open_ended_count > 0 ? null : row.expires_at);
  }

  const byDate = new Map<string, Record<string, number>>();
  for (const row of result.results ?? []) {
    const bucket = byDate.get(row.date) ?? {};
    bucket[row.asset_class] = row.total;
    byDate.set(row.date, bucket);
  }

  const dates = [...byDate.keys()].sort();
  const lastKnown: Partial<Record<AssetClass, number>> = {};

  const points = dates.map((date) => {
    const bucket = byDate.get(date)!;
    const point: NetWorthByClassPoint = { date, net_worth: 0 };
    let netWorth = 0;
    for (const { id } of ASSET_CLASSES) {
      // Carry forward the last known total when a class has no row for this
      // date (e.g. its account stopped syncing) instead of dropping to zero
      // -- unless every contributing account for this class has expired as
      // of this date, in which case the value should actually be gone.
      const expiry = classExpiry.get(id);
      const expired = expiry != null && date > expiry;
      const value = bucket[id] ?? (expired ? 0 : lastKnown[id] ?? 0);
      lastKnown[id] = value;
      point[id] = value;
      netWorth += id === "liabilities" ? -value : value;
    }
    point.net_worth = netWorth;

    // The by-class breakdown shows home equity, not gross real estate value
    // and a separate debt line -- net_worth above already accounts for the
    // true liabilities total, so this only affects the displayed category.
    point.real_estate = Number(point.real_estate ?? 0) - Number(point.liabilities ?? 0);
    point.liabilities = 0;

    return point;
  });

  return points;
}
