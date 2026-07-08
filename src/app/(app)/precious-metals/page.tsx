import { getDB } from "@/lib/db";
import { getSpotPrices } from "@/lib/spot-price";
import { getMetalItems, getMetalCollectionSummary, getMetalValueHistory } from "@/lib/metal-items";
import { PreciousMetalsDashboard } from "@/components/precious-metals-dashboard";

export default async function PreciousMetalsPage() {
  const db = await getDB();
  const prices = await getSpotPrices(db);

  const [items, summary, valueHistory] = await Promise.all([
    getMetalItems(db),
    getMetalCollectionSummary(db, prices),
    getMetalValueHistory(db),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Precious Metals</h1>
      <PreciousMetalsDashboard
        spotPrices={prices}
        summary={summary}
        valueHistory={valueHistory}
        initialItems={items}
      />
    </div>
  );
}
