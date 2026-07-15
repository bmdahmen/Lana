import { ASSET_CLASSES, type AssetClass } from "@/lib/asset-classes";
import { OWNERS, type Owner } from "@/lib/owners";
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

/** Composite key for an asset class's value scoped to one owner, e.g.
 *  "cash:brian" -- lets a single flat point carry both the family total
 *  (under the plain class id, unchanged) and each owner's slice, so owner
 *  filtering can remap which key a chart line reads from without any
 *  changes to the aggregation's basic shape. */
function ownerKey(classId: string, owner: Owner): string {
  return `${classId}:${owner}`;
}

async function computeNetWorthSeries(db: D1Database): Promise<NetWorthByClassPoint[]> {
  const result = await db
    .prepare(
      `SELECT abh.date, a.asset_class, a.owner, SUM(abh.current_balance) as total
       FROM account_balance_history abh
       JOIN account a ON a.id = abh.account_id
       WHERE a.is_closed = 0 AND a.is_hidden = 0
         AND (a.relevant_until IS NULL OR abh.date <= a.relevant_until)
       GROUP BY abh.date, a.asset_class, a.owner
       ORDER BY abh.date ASC`
    )
    .all<{ date: string; asset_class: AssetClass; owner: Owner; total: number }>();

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
    bucket[ownerKey(row.asset_class, row.owner)] = row.total;
    byDate.set(row.date, bucket);
  }

  const dates = [...byDate.keys()].sort();
  const lastKnown: Record<string, number> = {};

  const points = dates.map((date) => {
    const bucket = byDate.get(date)!;
    const point: NetWorthByClassPoint = { date, net_worth: 0 };
    let netWorth = 0;
    const netWorthByOwner: Record<Owner, number> = { brian: 0, emily: 0 };

    for (const { id } of ASSET_CLASSES) {
      // Carry forward the last known total when an owner has no row for this
      // date (e.g. their account stopped syncing, or their history is only
      // sparse/monthly) instead of dropping to zero -- unless every
      // contributing account for this class has expired as of this date, in
      // which case the value should actually be gone. The class-level total
      // is always the sum of each owner's (independently carried-forward)
      // value, never read straight from the SQL-grouped row -- two owners
      // rarely have a balance row on the exact same date (e.g. one owner's
      // history is biweekly on different days than the other's), so a date
      // with only one owner's row would otherwise undercount the class by
      // dropping the other owner's carried-forward contribution entirely.
      const expiry = classExpiry.get(id);
      const expired = expiry != null && date > expiry;
      let value = 0;

      for (const { id: owner } of OWNERS) {
        const key = ownerKey(id, owner);
        const ownerValue = bucket[key] ?? (expired ? 0 : lastKnown[key] ?? 0);
        lastKnown[key] = ownerValue;
        point[key] = ownerValue;
        netWorthByOwner[owner] += id === "liabilities" ? -ownerValue : ownerValue;
        value += ownerValue;
      }

      point[id] = value;
      netWorth += id === "liabilities" ? -value : value;
    }
    point.net_worth = netWorth;
    for (const { id: owner } of OWNERS) {
      point[ownerKey("net_worth", owner)] = netWorthByOwner[owner];
    }

    // The by-class breakdown shows home equity, not gross real estate value
    // and a separate debt line -- net_worth above already accounts for the
    // true liabilities total, so this only affects the displayed category.
    point.real_estate = Number(point.real_estate ?? 0) - Number(point.liabilities ?? 0);
    point.liabilities = 0;
    for (const { id: owner } of OWNERS) {
      const realEstateKey = ownerKey("real_estate", owner);
      const liabilitiesKey = ownerKey("liabilities", owner);
      point[realEstateKey] = Number(point[realEstateKey] ?? 0) - Number(point[liabilitiesKey] ?? 0);
      point[liabilitiesKey] = 0;
    }

    return point;
  });

  return points;
}
