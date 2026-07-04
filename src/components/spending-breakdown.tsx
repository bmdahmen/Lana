"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

interface BreakdownRow {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  total: number;
  count: number;
}

export function SpendingBreakdown({
  initialBreakdown,
  initialFrom,
}: {
  initialBreakdown: BreakdownRow[];
  initialFrom: string;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState("");
  const [breakdown, setBreakdown] = useState(initialBreakdown);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/insights/spending?${params.toString()}`);
    const data = (await res.json()) as { breakdown?: BreakdownRow[] };
    setBreakdown(data.breakdown ?? []);
  }, [from, to]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const max = Math.max(...breakdown.map((b) => b.total), 1);
  const total = breakdown.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-500">Total spending</h2>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(total)}
          </p>
        </div>

        {breakdown.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No spending in this period.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {breakdown.map((row) => (
              <li key={row.category_id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {row.category_icon} {row.category_name}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {formatCurrency(row.total)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.total / max) * 100}%`,
                      backgroundColor: "var(--chart-net-worth)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
