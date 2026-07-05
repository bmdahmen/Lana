import { getDB } from "@/lib/db";
import { getNetWorthSeries } from "@/lib/queries";
import { NetWorthHistory } from "@/components/net-worth-history";
import { HISTORY_RANGES } from "@/lib/net-worth-range";

const DEFAULT_DAYS = HISTORY_RANGES[HISTORY_RANGES.length - 1].days;

export default async function NetWorthPage() {
  const db = await getDB();

  const points = await getNetWorthSeries(db);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Net Worth</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Toggle categories below to compare accounts on the chart.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <NetWorthHistory initialPoints={points} initialDays={DEFAULT_DAYS} />
      </div>
    </div>
  );
}
