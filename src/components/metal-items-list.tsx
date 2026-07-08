"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { formatCurrency, formatTroyOz, formatDate } from "@/lib/format";
import {
  METAL_ITEM_CATEGORIES,
  categoryLabel,
  mintCountry,
  type MetalItem,
  type MetalItemCategory,
} from "@/lib/metal-items";
import { PRECIOUS_METALS, type PreciousMetal } from "@/lib/asset-classes";
import { EditMetalItemModal, QuickEditQuantityFields } from "@/components/metal-item-modal";
import { SwipeableRow } from "@/components/swipeable-row";
import { useRouter } from "next/navigation";

interface SeriesGroup {
  key: string;
  name: string;
  items: MetalItem[];
  totalQuantity: number;
  totalOz: number;
  value: number;
}

interface CountryGroup {
  key: string;
  flag: string | null;
  name: string;
  series: SeriesGroup[];
  value: number;
  totalOz: number;
}

interface CategoryGroup {
  category: MetalItemCategory;
  series: SeriesGroup[];
  countryGroups: CountryGroup[] | null;
  value: number;
  totalOz: number;
}

interface MetalGroup {
  metal: PreciousMetal;
  categories: CategoryGroup[];
  value: number;
  totalOz: number;
}

function buildSeries(items: MetalItem[], itemValue: (item: MetalItem) => number, keyPrefix: string): SeriesGroup[] {
  const bySeries = new Map<string, MetalItem[]>();
  for (const item of items) {
    const list = bySeries.get(item.name) ?? [];
    list.push(item);
    bySeries.set(item.name, list);
  }

  return [...bySeries.entries()]
    .map(([name, seriesItems]) => {
      const sorted = [...seriesItems].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      const totalOz = sorted.reduce((sum, i) => sum + i.quantity * i.troy_oz_each, 0);
      const totalQuantity = sorted.reduce((sum, i) => sum + i.quantity, 0);
      const value = sorted.reduce((sum, i) => sum + itemValue(i), 0);
      return { key: `${keyPrefix}:${name}`, name, items: sorted, totalQuantity, totalOz, value };
    })
    .sort((a, b) => b.value - a.value);
}

/** The Government category spans several sovereign mints (US, Canada,
 *  Austria, ...) -- grouping its series under a flagged country header keeps
 *  e.g. every US series together instead of interleaving with Austrian
 *  Philharmonics by value alone. Other categories (bars/rounds, junk silver,
 *  numismatic) don't have a consistent per-series issuer, so they stay flat. */
function buildCountryGroups(
  items: MetalItem[],
  itemValue: (item: MetalItem) => number,
  keyPrefix: string
): CountryGroup[] {
  const byCountry = new Map<string, MetalItem[]>();
  for (const item of items) {
    const country = mintCountry(item.mint);
    const key = country?.name ?? "Other";
    const list = byCountry.get(key) ?? [];
    list.push(item);
    byCountry.set(key, list);
  }

  return [...byCountry.entries()]
    .map(([name, countryItems]) => {
      const series = buildSeries(countryItems, itemValue, `${keyPrefix}:${name}`);
      return {
        key: name,
        flag: mintCountry(countryItems[0].mint)?.flag ?? null,
        name,
        series,
        value: series.reduce((sum, s) => sum + s.value, 0),
        totalOz: series.reduce((sum, s) => sum + s.totalOz, 0),
      };
    })
    .sort((a, b) => b.value - a.value);
}

function groupByCategory(items: MetalItem[], itemValue: (item: MetalItem) => number, keyPrefix: string): CategoryGroup[] {
  const byCategory = new Map<MetalItemCategory, MetalItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const categories: CategoryGroup[] = [...byCategory.entries()].map(([category, categoryItems]) => {
    const isGovernment = category === "bullion_coin";
    const countryGroups = isGovernment
      ? buildCountryGroups(categoryItems, itemValue, `${keyPrefix}:${category}`)
      : null;
    const series = isGovernment ? [] : buildSeries(categoryItems, itemValue, `${keyPrefix}:${category}`);
    const value = isGovernment
      ? countryGroups!.reduce((sum, c) => sum + c.value, 0)
      : series.reduce((sum, s) => sum + s.value, 0);
    const totalOz = isGovernment
      ? countryGroups!.reduce((sum, c) => sum + c.totalOz, 0)
      : series.reduce((sum, s) => sum + s.totalOz, 0);

    return { category, series, countryGroups, value, totalOz };
  });

  return categories.sort((a, b) => b.value - a.value);
}

/** Gold and silver troy oz don't mean anything summed together, and mixing
 *  their series into one list makes categories like "Government" (which
 *  spans both) hard to scan -- so this groups by metal first, but only
 *  renders that tier when the filtered results actually span more than one
 *  metal (a metal filter, or a narrow search, often leaves just one). */
function groupItems(items: MetalItem[], spotPrices: Record<PreciousMetal, number> | null): MetalGroup[] {
  const itemValue = (item: MetalItem) => (spotPrices ? item.quantity * item.troy_oz_each * spotPrices[item.metal] : 0);

  const byMetal = new Map<PreciousMetal, MetalItem[]>();
  for (const item of items) {
    const list = byMetal.get(item.metal) ?? [];
    list.push(item);
    byMetal.set(item.metal, list);
  }

  const groups: MetalGroup[] = PRECIOUS_METALS.filter((m) => byMetal.has(m)).map((metal) => {
    const metalItems = byMetal.get(metal)!;
    const categories = groupByCategory(metalItems, itemValue, metal);
    return {
      metal,
      categories,
      value: categories.reduce((sum, c) => sum + c.value, 0),
      totalOz: categories.reduce((sum, c) => sum + c.totalOz, 0),
    };
  });

  return groups;
}

export function MetalItemsList({
  initialItems,
  spotPrices,
  metalFilter,
  categoryFilter,
  onMetalFilterChange,
  onCategoryFilterChange,
}: {
  initialItems: MetalItem[];
  spotPrices: Record<PreciousMetal, number> | null;
  metalFilter: PreciousMetal | null;
  categoryFilter: MetalItemCategory | null;
  onMetalFilterChange: (metal: PreciousMetal | null) => void;
  onCategoryFilterChange: (category: MetalItemCategory | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<MetalItem | null>(null);
  // The single lot row currently expanded for quick quantity editing, if any
  // -- same one-open-at-a-time, expand-in-place pattern as the Rules tab.
  const [quickEditingId, setQuickEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (metalFilter) params.set("metal", metalFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/metal-items?${params.toString()}`);
      const data = (await res.json()) as { items?: MetalItem[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [metalFilter, categoryFilter, query]);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
  }, [load]);

  const groups = useMemo(() => groupItems(items, spotPrices), [items, spotPrices]);

  // Searching narrows the result set enough that requiring an extra click
  // per series just to see what matched would be annoying -- expand
  // everything while a query is active instead of tracking it in `expanded`.
  const searching = query.trim().length > 0;

  function toggleSeries(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleQuickEdit(id: string) {
    setQuickEditingId((prev) => (prev === id ? null : id));
  }

  async function deleteItem(item: MetalItem) {
    if (!confirm(`Remove ${item.year ? `${item.year} ` : ""}${item.name} from the collection?`)) return;
    if (quickEditingId === item.id) setQuickEditingId(null);
    const res = await fetch(`/api/metal-items/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(data?.error ?? "Failed to delete item");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onMetalFilterChange(null)}
          className={clsx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
            metalFilter === null
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          )}
        >
          All metals
        </button>
        {PRECIOUS_METALS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMetalFilterChange(metalFilter === m ? null : m)}
            className={clsx(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              metalFilter === m
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            )}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onCategoryFilterChange(null)}
          className={clsx(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
            categoryFilter === null
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          )}
        >
          All categories
        </button>
        {METAL_ITEM_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCategoryFilterChange(categoryFilter === c.id ? null : c.id)}
            className={clsx(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              categoryFilter === c.id
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or mint…"
        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {!loading && groups.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No items match these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((metalGroup) => (
            <div key={metalGroup.metal} className="flex flex-col gap-3">
              {groups.length > 1 && (
                <div className="flex items-baseline justify-between border-b border-zinc-200 pb-1 dark:border-zinc-800">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--chart-${metalGroup.metal})` }}
                    />
                    {metalGroup.metal === "gold" ? "Gold" : "Silver"}
                  </h2>
                  <span className="text-sm font-medium text-zinc-500">
                    {formatTroyOz(metalGroup.totalOz)} · {formatCurrency(metalGroup.value)}
                  </span>
                </div>
              )}
              {metalGroup.categories.map((group) => (
                <CategorySection
                  key={group.category}
                  group={group}
                  searching={searching}
                  expanded={expanded}
                  toggleSeries={toggleSeries}
                  spotPrices={spotPrices}
                  setEditing={setEditing}
                  quickEditingId={quickEditingId}
                  toggleQuickEdit={toggleQuickEdit}
                  setQuickEditingId={setQuickEditingId}
                  deleteItem={deleteItem}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditMetalItemModal item={editing} onClose={() => setEditing(null)} spotPrices={spotPrices} />
      )}
    </div>
  );
}

function CategorySection({
  group,
  searching,
  expanded,
  toggleSeries,
  spotPrices,
  setEditing,
  quickEditingId,
  toggleQuickEdit,
  setQuickEditingId,
  deleteItem,
}: {
  group: CategoryGroup;
  searching: boolean;
  expanded: Set<string>;
  toggleSeries: (key: string) => void;
  spotPrices: Record<PreciousMetal, number> | null;
  setEditing: (item: MetalItem) => void;
  quickEditingId: string | null;
  toggleQuickEdit: (id: string) => void;
  setQuickEditingId: (id: string | null) => void;
  deleteItem: (item: MetalItem) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between px-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {categoryLabel(group.category)}
        </h3>
        <span className="text-xs font-medium text-zinc-400 dark:text-zinc-600">
          {formatTroyOz(group.totalOz)} · {formatCurrency(group.value)}
        </span>
      </div>
      {group.countryGroups ? (
        <div className="flex flex-col gap-2.5">
          {group.countryGroups.map((country) => (
            <div key={country.key}>
              <div className="mb-1 flex items-baseline justify-between px-0.5">
                <span className="text-xs font-medium text-zinc-500">
                  {country.flag ? `${country.flag} ` : ""}
                  {country.name}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-600">
                  {formatTroyOz(country.totalOz)} · {formatCurrency(country.value)}
                </span>
              </div>
              <SeriesList
                series={country.series}
                searching={searching}
                expanded={expanded}
                toggleSeries={toggleSeries}
                spotPrices={spotPrices}
                setEditing={setEditing}
                quickEditingId={quickEditingId}
                toggleQuickEdit={toggleQuickEdit}
                setQuickEditingId={setQuickEditingId}
                deleteItem={deleteItem}
              />
            </div>
          ))}
        </div>
      ) : (
        <SeriesList
          series={group.series}
          searching={searching}
          expanded={expanded}
          toggleSeries={toggleSeries}
          spotPrices={spotPrices}
          setEditing={setEditing}
          quickEditingId={quickEditingId}
          toggleQuickEdit={toggleQuickEdit}
          setQuickEditingId={setQuickEditingId}
          deleteItem={deleteItem}
        />
      )}
    </div>
  );
}

function SeriesList({
  series,
  searching,
  expanded,
  toggleSeries,
  spotPrices,
  setEditing,
  quickEditingId,
  toggleQuickEdit,
  setQuickEditingId,
  deleteItem,
}: {
  series: SeriesGroup[];
  searching: boolean;
  expanded: Set<string>;
  toggleSeries: (key: string) => void;
  spotPrices: Record<PreciousMetal, number> | null;
  setEditing: (item: MetalItem) => void;
  quickEditingId: string | null;
  toggleQuickEdit: (id: string) => void;
  setQuickEditingId: (id: string | null) => void;
  deleteItem: (item: MetalItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {series.map((s) => {
          const isOpen = searching || expanded.has(s.key);
          const lotCount = s.items.length;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggleSeries(s.key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    <span className={clsx("inline-block text-zinc-400 transition-transform", isOpen && "rotate-90")}>
                      ›
                    </span>
                    {s.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-600">
                    {lotCount} lot{lotCount === 1 ? "" : "s"} · {s.totalQuantity} item{s.totalQuantity === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(s.value)}</p>
                  <p className="text-xs text-zinc-500">{formatTroyOz(s.totalOz)}</p>
                </div>
              </button>
              {isOpen && (
                <ul className="divide-y divide-zinc-50 border-t border-zinc-100 dark:divide-zinc-900 dark:border-zinc-900">
                  {s.items.map((item) => (
                    <li key={item.id}>
                      <SwipeableRow
                        onEdit={() => toggleQuickEdit(item.id)}
                        onDelete={() => deleteItem(item)}
                        className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      >
                        <div className="flex items-center justify-between gap-3 py-2 pr-4 pl-9">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                              {item.year ? `${item.year}` : "Undated"}
                              {item.condition ? ` · ${item.condition}` : ""}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-600">
                              {itemSubline(item, { includeCondition: false })}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                              {formatCurrency(itemValue(item, spotPrices))}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {item.quantity} × {formatTroyOz(item.troy_oz_each)}
                            </p>
                          </div>
                        </div>
                      </SwipeableRow>
                      {quickEditingId === item.id && (
                        <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 pl-9 dark:border-zinc-900 dark:bg-zinc-900">
                          <QuickEditQuantityFields
                            item={item}
                            onSaved={() => setQuickEditingId(null)}
                            onCancel={() => setQuickEditingId(null)}
                            onEditFullDetails={() => {
                              setEditing(item);
                              setQuickEditingId(null);
                            }}
                            spotPrices={spotPrices}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function itemValue(item: MetalItem, spotPrices: Record<PreciousMetal, number> | null): number {
  if (!spotPrices) return 0;
  return item.quantity * item.troy_oz_each * spotPrices[item.metal];
}

function itemSubline(item: MetalItem, options?: { includeCondition?: boolean }): string {
  const parts: string[] = [];
  if (item.mint) parts.push(item.mint);
  if (options?.includeCondition !== false && item.condition) parts.push(item.condition);
  if (item.purchase_price_total) {
    parts.push(
      `Paid ${formatCurrency(item.purchase_price_total)}${item.purchase_date ? ` · ${formatDate(item.purchase_date)}` : ""}`
    );
  }
  return parts.join(" · ") || "—";
}
