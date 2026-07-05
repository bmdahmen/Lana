"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { TransactionsTable } from "@/components/transactions-table";

const MONTHS_BACK = 12;

interface BreakdownRow {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  total: number;
  count: number;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface MonthOption {
  from: string;
  to: string;
  label: string;
}

function toISODate(year: number, month: number, day: number): string {
  return new Date(year, month, day).toISOString().slice(0, 10);
}

function buildMonthOptions(count: number): MonthOption[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const year = now.getFullYear();
    const month = now.getMonth() - i;
    const start = new Date(year, month, 1);
    return {
      from: toISODate(start.getFullYear(), start.getMonth(), 1),
      to: toISODate(start.getFullYear(), start.getMonth() + 1, 0),
      label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });
}

export function SpendingBreakdown({
  initialBreakdown,
  categories,
}: {
  initialBreakdown: BreakdownRow[];
  categories: Category[];
}) {
  const monthOptions = useMemo(() => buildMonthOptions(MONTHS_BACK), []);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const { from, to, label } = monthOptions[selectedMonth];
  const [breakdown, setBreakdown] = useState(initialBreakdown);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<BreakdownRow | null>(null);
  const requestIdRef = useRef(0);

  function selectMonth(index: number) {
    setSelectedMonth(index);
    // A category filter from a different month's breakdown wouldn't
    // necessarily still apply, so clear it on every month switch.
    setActiveCategory(null);
  }

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/insights/spending?${params.toString()}`);
      const data = (await res.json()) as { breakdown?: BreakdownRow[] };
      // Ignore stale responses from a request superseded by a later month switch.
      if (requestId !== requestIdRef.current) return;
      setBreakdown(data.breakdown ?? []);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const max = Math.max(...breakdown.map((b) => b.total), 1);
  const total = breakdown.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {monthOptions.map((m, i) => (
          <button
            key={m.from}
            type="button"
            onClick={() => selectMonth(i)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              i === selectedMonth
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {i === 0 ? "This month" : m.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-500">Total spending &middot; {label}</h2>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(total)}
          </p>
        </div>

        {!loading && breakdown.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No spending in this period.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {breakdown.map((row) => {
              const isActive = activeCategory?.category_id === row.category_id;
              return (
                <li key={row.category_id}>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(isActive ? null : row)}
                    aria-pressed={isActive}
                    className="group w-full rounded-md text-left"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                        {row.category_icon} {row.category_name}
                      </span>
                      <span className="text-zinc-600 group-hover:underline dark:text-zinc-400">
                        {formatCurrency(row.total)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                      <div
                        className="h-full rounded-full transition-opacity"
                        style={{
                          width: `${(row.total / max) * 100}%`,
                          backgroundColor: "var(--chart-net-worth)",
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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500">
            {activeCategory
              ? `${activeCategory.category_icon} ${activeCategory.category_name} transactions`
              : "All transactions"}
            {" · "}
            {label}
          </h2>
          {activeCategory && (
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Clear filter
            </button>
          )}
        </div>
        <TransactionsTable
          key={`${from}:${to}`}
          categories={categories}
          fixedCategoryId={activeCategory?.category_id}
          from={from}
          to={to}
          defaultSort="amount"
          collapsibleSearch
          hideCategoryDropdown
        />
      </div>
    </div>
  );
}
