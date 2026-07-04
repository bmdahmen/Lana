import { ASSET_CLASSES, type AssetClass } from "@/lib/asset-classes";

export interface NetWorthByClassPoint {
  date: string;
  net_worth: number;
  [key: string]: number | string;
}

export async function getNetWorthByClass(
  db: D1Database,
  days: number
): Promise<NetWorthByClassPoint[]> {
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
      // date (e.g. its account stopped syncing) instead of dropping to zero.
      const value = bucket[id] ?? lastKnown[id] ?? 0;
      lastKnown[id] = value;
      point[id] = value;
      netWorth += id === "liabilities" ? -value : value;
    }
    point.net_worth = netWorth;
    return point;
  });

  // `days` is a calendar cutoff, not an entry count -- history is often
  // monthly-granularity (or sparser), so slicing by index would return the
  // entire series for any range longer than a few data points.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const cutoffIndex = points.findIndex((p) => p.date >= cutoffDate);
  if (cutoffIndex <= 0) return points;

  // Keep one point before the cutoff as the range's starting baseline, so
  // delta/percent-change reflects the value as of the start of the range
  // instead of falling back to zero.
  return points.slice(cutoffIndex - 1);
}
