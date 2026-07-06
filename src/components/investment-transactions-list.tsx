"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { classifyInvestmentFlow } from "@/lib/investment-transactions";

const PAGE_SIZE = 100;

interface InvestmentTransaction {
  id: string;
  account_id: string;
  account_name: string;
  security_name: string | null;
  date: string;
  name: string;
  amount: number;
  quantity: number | null;
  price: number | null;
  type: string;
  subtype: string;
}

function typeLabel(type: string, subtype: string): string {
  const flow = classifyInvestmentFlow(type, subtype);
  if (flow === "contribution") return type === "buy" ? "Buy" : "Contribution";
  if (flow === "distribution") return type === "sell" ? "Sell" : "Withdrawal";
  return subtype.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function InvestmentTransactionsList({
  fixedAccountId,
  assetClasses,
  from,
  to,
  defaultSort = "amount",
}: {
  fixedAccountId?: string;
  assetClasses?: string[];
  from?: string;
  to?: string;
  defaultSort?: "recent" | "amount";
}) {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [sortMode, setSortMode] = useState<"recent" | "amount">(defaultSort);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const assetClassKey = assetClasses?.join(",") ?? "";

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (fixedAccountId) params.set("accountId", fixedAccountId);
      if (assetClassKey) params.set("assetClass", assetClassKey);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (sortMode !== "recent") params.set("sort", sortMode);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      return params;
    },
    [fixedAccountId, assetClassKey, from, to, sortMode]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/investment-transactions?${buildParams(0).toString()}`);
      const data = (await res.json()) as { transactions?: InvestmentTransaction[] };
      const results = data.transactions ?? [];
      setTransactions(results);
      setHasMore(results.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/investment-transactions?${buildParams(transactions.length).toString()}`);
      const data = (await res.json()) as { transactions?: InvestmentTransaction[] };
      const results = data.transactions ?? [];
      setTransactions((prev) => [...prev, ...results]);
      setHasMore(results.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-1">
        {(["amount", "recent"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSortMode(mode)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              sortMode === mode
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {mode === "amount" ? "Amount" : "Recent"}
          </button>
        ))}
      </div>

      {!loading && transactions.length === 0 && (
        <p className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No investment transactions found.
        </p>
      )}

      {transactions.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {transactions.map((tx) => {
            const flow = classifyInvestmentFlow(tx.type, tx.subtype);
            const color = flow === "contribution" ? "var(--positive)" : undefined;
            const sign = flow === "contribution" ? "+" : flow === "distribution" ? "-" : tx.amount > 0 ? "-" : "+";
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {tx.security_name ?? tx.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {typeLabel(tx.type, tx.subtype)} · {tx.account_name}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-medium" style={color ? { color } : undefined}>
                    {sign}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                  <span className="text-xs text-zinc-500">{formatDate(tx.date)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
