import { getDB } from "@/lib/db";
import { recomputeNetWorth } from "@/lib/sync";
import { getNetWorthByClass } from "@/lib/queries";
import { NetWorthHistory } from "@/components/net-worth-history";

const DEFAULT_DAYS = 4400;

export default async function NetWorthPage() {
  const db = await getDB();
  await recomputeNetWorth(db);

  const points = await getNetWorthByClass(db, DEFAULT_DAYS);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Net Worth</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <NetWorthHistory initialPoints={points} initialDays={DEFAULT_DAYS} />
      </div>
    </div>
  );
}
