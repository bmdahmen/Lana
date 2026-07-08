"use client";

import { formatCurrency, formatTroyOz } from "@/lib/format";
import type { PreciousMetal } from "@/lib/asset-classes";
import { categoryLabel, type MetalCollectionSummary, type MetalItem, type MetalValuePoint } from "@/lib/metal-items";
import { MetalValueChart } from "@/components/metal-value-chart";
import { AddMetalItemButton } from "@/components/metal-item-modal";
import { MetalItemsList } from "@/components/metal-items-list";

export function PreciousMetalsDashboard({
  spotPrices,
  summary,
  valueHistory,
  initialItems,
}: {
  spotPrices: Record<PreciousMetal, number>;
  summary: MetalCollectionSummary;
  valueHistory: MetalValuePoint[];
  initialItems: MetalItem[];
}) {
  const totalValue = summary.value.gold + summary.value.silver;
  const totalCostBasis = summary.costBasis.gold + summary.costBasis.silver;
  const totalItems = summary.itemCount.gold + summary.itemCount.silver;
  const ratio = spotPrices.silver > 0 ? spotPrices.gold / spotPrices.silver : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SpotCard label="Gold spot" value={formatCurrency(spotPrices.gold)} sublabel="per troy oz" color="--chart-gold" />
        <SpotCard label="Silver spot" value={formatCurrency(spotPrices.silver)} sublabel="per troy oz" color="--chart-silver" />
        <SpotCard label="Gold/Silver ratio" value={ratio.toFixed(1)} sublabel="oz of silver per oz gold" />
        <SpotCard label="Collection value" value={formatCurrency(totalValue)} sublabel={`${totalItems} items`} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-medium text-zinc-500">Value over time</h2>
        <MetalValueChart points={valueHistory} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetalSummaryCard metal="gold" summary={summary} />
        <MetalSummaryCard metal="silver" summary={summary} />
      </div>

      {totalCostBasis > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Cost basis (known purchases)</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(totalCostBasis)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-500">Unrealized</p>
              <p
                className="text-lg font-semibold"
                style={{ color: totalValue - totalCostBasis >= 0 ? "var(--positive)" : "var(--negative)" }}
              >
                {totalValue - totalCostBasis >= 0 ? "+" : ""}
                {formatCurrency(totalValue - totalCostBasis)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Only reflects items with a recorded purchase price — many older lots don&apos;t have one.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500">Holdings</h2>
          <AddMetalItemButton spotPrices={spotPrices} />
        </div>
        <MetalItemsList initialItems={initialItems} spotPrices={spotPrices} />
      </div>
    </div>
  );
}

function SpotCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `var(${color})` }} />}
        {label}
      </p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-600">{sublabel}</p>
    </div>
  );
}

function MetalSummaryCard({ metal, summary }: { metal: PreciousMetal; summary: MetalCollectionSummary }) {
  const categories = summary.byCategory[metal];
  const max = Math.max(...categories.map((c) => c.value), 1);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: `var(--chart-${metal})` }}
          />
          {metal === "gold" ? "Gold" : "Silver"}
        </h3>
        <span className="text-sm text-zinc-500">{formatTroyOz(summary.troyOz[metal])}</span>
      </div>
      <p className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {formatCurrency(summary.value[metal])}
      </p>
      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">No {metal} items yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {categories.map((c) => (
            <li key={c.category}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {categoryLabel(c.category)} · {c.itemCount}
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(c.value)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.value / max) * 100}%`, backgroundColor: `var(--chart-${metal})` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
