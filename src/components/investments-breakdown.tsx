"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { TransactionsTable } from "@/components/transactions-table";
import { buildMonthOptions } from "@/lib/month-range";
import { ASSET_CLASSES } from "@/lib/asset-classes";

const MONTHS_BACK = 12;

type InvestmentAssetClass = "brokerage" | "retirement" | "crypto";

const INVESTMENT_CLASS_IDS: InvestmentAssetClass[] = ["brokerage", "retirement", "crypto"];
const ASSET_CLASS_FILTERS = ASSET_CLASSES.filter(
  (c): c is typeof c & { id: InvestmentAssetClass } =>
    INVESTMENT_CLASS_IDS.includes(c.id as InvestmentAssetClass)
);

interface BreakdownRow {
  account_id: string;
  account_name: string;
  asset_class: InvestmentAssetClass;
  contributions: number;
  distributions: number;
  count: number;
}

function classIcon(assetClass: InvestmentAssetClass): string {
  return ASSET_CLASS_FILTERS.find((c) => c.id === assetClass)?.icon ?? "💰";
}

export function InvestmentsBreakdown({ initialBreakdown }: { initialBreakdown: BreakdownRow[] }) {
  const monthOptions = useMemo(() => buildMonthOptions(MONTHS_BACK), []);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const { from, to, label } = monthOptions[selectedMonth];
  const [assetClassFilter, setAssetClassFilter] = useState<InvestmentAssetClass | null>(null);
  const [breakdown, setBreakdown] = useState(initialBreakdown);
  const [loading, setLoading] = useState(false);
  const [activeAccount, setActiveAccount] = useState<BreakdownRow | null>(null);
  const requestIdRef = useRef(0);

  function selectMonth(index: number) {
    setSelectedMonth(index);
    setActiveAccount(null);
  }

  function selectAssetClass(cls: InvestmentAssetClass | null) {
    setAssetClassFilter(cls);
    setActiveAccount(null);
  }

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (assetClassFilter) params.set("assetClass", assetClassFilter);
      const res = await fetch(`/api/insights/investments?${params.toString()}`);
      const data = (await res.json()) as { breakdown?: BreakdownRow[] };
      if (requestId !== requestIdRef.current) return;
      setBreakdown(data.breakdown ?? []);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [from, to, assetClassFilter]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const max = Math.max(...breakdown.map((b) => b.contributions), 1);
  const totalContributions = breakdown.reduce((sum, b) => sum + b.contributions, 0);
  const totalDistributions = breakdown.reduce((sum, b) => sum + b.distributions, 0);
  const listAssetClasses = assetClassFilter
    ? [assetClassFilter]
    : ASSET_CLASS_FILTERS.map((c) => c.id);

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => selectAssetClass(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            assetClassFilter === null
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          All accounts
        </button>
        {ASSET_CLASS_FILTERS.map((cls) => (
          <button
            key={cls.id}
            type="button"
            onClick={() => selectAssetClass(cls.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              assetClassFilter === cls.id
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {cls.icon} {cls.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Contributed &middot; {label}</h2>
            <p className="text-2xl font-semibold" style={{ color: "var(--positive)" }}>
              {formatCurrency(totalContributions)}
            </p>
          </div>
          {totalDistributions > 0 && (
            <div className="text-right">
              <h2 className="text-sm font-medium text-zinc-500">Distributed</h2>
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(totalDistributions)}
              </p>
            </div>
          )}
        </div>

        {!loading && breakdown.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No investment contributions in this period.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {breakdown.map((row) => {
              const isActive = activeAccount?.account_id === row.account_id;
              return (
                <li key={row.account_id}>
                  <button
                    type="button"
                    onClick={() => setActiveAccount(isActive ? null : row)}
                    aria-pressed={isActive}
                    className="group w-full rounded-md text-left"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                        {classIcon(row.asset_class)} {row.account_name}
                      </span>
                      <span className="text-zinc-600 group-hover:underline dark:text-zinc-400">
                        {formatCurrency(row.contributions)}
                        {row.distributions > 0 && (
                          <span className="text-zinc-400"> · -{formatCurrency(row.distributions)}</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                      <div
                        className="h-full rounded-full transition-opacity"
                        style={{
                          width: `${(row.contributions / max) * 100}%`,
                          backgroundColor: "var(--positive)",
                          opacity: activeAccount && !isActive ? 0.35 : 1,
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
            {activeAccount ? `${activeAccount.account_name} transactions` : "All transactions"}
            {" · "}
            {label}
          </h2>
          {activeAccount && (
            <button
              type="button"
              onClick={() => setActiveAccount(null)}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Clear filter
            </button>
          )}
        </div>
        <TransactionsTable
          key={`${from}:${to}:${assetClassFilter ?? "all"}`}
          categories={[]}
          fixedAccountId={activeAccount?.account_id}
          assetClasses={listAssetClasses}
          from={from}
          to={to}
          defaultSort="amount"
          collapsibleSearch
          hideCategoryDropdown
          hideCategoryColumn
        />
      </div>
    </div>
  );
}
