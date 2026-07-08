"use client";

import { useState } from "react";
import { formatCurrency, formatTroyOz } from "@/lib/format";
import type { PreciousMetal } from "@/lib/asset-classes";
import {
  categoryLabel,
  type MetalCollectionSummary,
  type MetalItem,
  type MetalItemCategory,
  type MetalValuePoint,
} from "@/lib/metal-items";
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
  const ratio = spotPrices.silver > 0 ? spotPrices.gold / spotPrices.silver : 0;

  const [metalFilter, setMetalFilter] = useState<PreciousMetal | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<MetalItemCategory | null>(null);

  // Clicking a category bar in the Gold/Silver cards filters the Holdings
  // list below to just that slice -- clicking the same one again clears it,
  // matching the category-breakdown-to-transaction-list pattern on Spending.
  function selectCategory(metal: PreciousMetal, category: MetalItemCategory) {
    if (metalFilter === metal && categoryFilter === category) {
      setMetalFilter(null);
      setCategoryFilter(null);
    } else {
      setMetalFilter(metal);
      setCategoryFilter(category);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetalSummaryCard
          metal="gold"
          summary={summary}
          activeCategory={metalFilter === "gold" ? categoryFilter : null}
          onSelectCategory={(category) => selectCategory("gold", category)}
        />
        <MetalSummaryCard
          metal="silver"
          summary={summary}
          activeCategory={metalFilter === "silver" ? categoryFilter : null}
          onSelectCategory={(category) => selectCategory("silver", category)}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-medium text-zinc-500">Value over time</h2>
        <MetalValueChart points={valueHistory} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SpotCard label="Gold spot" value={formatCurrency(spotPrices.gold)} sublabel="per troy oz" color="--chart-gold" />
        <SpotCard label="Silver spot" value={formatCurrency(spotPrices.silver)} sublabel="per troy oz" color="--chart-silver" />
        <SpotCard label="Gold/Silver ratio" value={ratio.toFixed(1)} sublabel="oz of silver per oz gold" />
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
          <h2 className="text-sm font-medium text-zinc-500">
            Holdings
            {(metalFilter || categoryFilter) && (
              <>
                {" · "}
                {metalFilter ? (metalFilter === "gold" ? "Gold" : "Silver") : "All metals"}
                {categoryFilter ? ` · ${categoryLabel(categoryFilter)}` : ""}
              </>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {(metalFilter || categoryFilter) && (
              <button
                type="button"
                onClick={() => {
                  setMetalFilter(null);
                  setCategoryFilter(null);
                }}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Clear filter
              </button>
            )}
            <AddMetalItemButton spotPrices={spotPrices} />
          </div>
        </div>
        <MetalItemsList
          initialItems={initialItems}
          spotPrices={spotPrices}
          metalFilter={metalFilter}
          categoryFilter={categoryFilter}
          onMetalFilterChange={setMetalFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
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

function MetalSummaryCard({
  metal,
  summary,
  activeCategory,
  onSelectCategory,
}: {
  metal: PreciousMetal;
  summary: MetalCollectionSummary;
  activeCategory: MetalItemCategory | null;
  onSelectCategory: (category: MetalItemCategory) => void;
}) {
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
          {categories.map((c) => {
            const isActive = activeCategory === c.category;
            return (
              <li key={c.category}>
                <button
                  type="button"
                  onClick={() => onSelectCategory(c.category)}
                  aria-pressed={isActive}
                  className="group w-full rounded-md text-left"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-zinc-600 group-hover:underline dark:text-zinc-400">
                      {categoryLabel(c.category)} · {formatTroyOz(c.troyOz)}
                    </span>
                    <span className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                      {formatCurrency(c.value)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div
                      className="h-full rounded-full transition-opacity"
                      style={{
                        width: `${(c.value / max) * 100}%`,
                        backgroundColor: `var(--chart-${metal})`,
                        opacity: activeCategory && !isActive ? 0.35 : 1,
                      }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
