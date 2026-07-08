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

  // Suggestions for the Name/Condition fields on the add/edit forms, so
  // adding another lot of something already tracked reuses the exact same
  // spelling instead of drifting (e.g. "Uncirculated" vs "uncirculated")
  // and splitting into a separate series/group.
  const nameOptions = [...new Set(items.map((i) => i.name))].sort((a, b) => a.localeCompare(b));
  const conditionOptions = [...new Set(items.map((i) => i.condition).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b)
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Precious Metals</h1>
      <PreciousMetalsDashboard
        spotPrices={prices}
        summary={summary}
        valueHistory={valueHistory}
        initialItems={items}
        nameOptions={nameOptions}
        conditionOptions={conditionOptions}
      />
    </div>
  );
}
