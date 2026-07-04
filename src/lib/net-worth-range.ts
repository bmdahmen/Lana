export interface NetWorthByClassPoint {
  date: string;
  net_worth: number;
  [key: string]: number | string;
}

export interface RangeOption {
  label: string;
  days: number;
}

/** Effectively "no cutoff" -- larger than any realistic account history. */
const ALL_DAYS = 36_500;

export const HOME_RANGES: RangeOption[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "5Y", days: 1825 },
  { label: "All", days: ALL_DAYS },
];

export const HISTORY_RANGES: RangeOption[] = [
  { label: "1Y", days: 365 },
  { label: "5Y", days: 1825 },
  { label: "10Y", days: 3650 },
  { label: "All", days: ALL_DAYS },
];

/**
 * Slices a full net-worth series down to a calendar cutoff. History is often
 * monthly-granularity (or sparser), so slicing by index would return the
 * entire series for any range longer than a few data points -- we need an
 * actual date comparison.
 */
export function sliceNetWorthPointsByDays(
  points: NetWorthByClassPoint[],
  days: number
): NetWorthByClassPoint[] {
  if (points.length === 0) return points;

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
