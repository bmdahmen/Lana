"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { NetWorthByClassChart } from "@/components/net-worth-by-class-chart";
import type { NetWorthByClassPoint } from "@/lib/queries";

const RANGES: { label: string; days: number }[] = [
  { label: "1Y", days: 365 },
  { label: "5Y", days: 1825 },
  { label: "10Y", days: 3650 },
  { label: "All", days: 4400 },
];

export function NetWorthHistory({
  initialPoints,
  initialDays,
}: {
  initialPoints: NetWorthByClassPoint[];
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);
  const [points, setPoints] = useState(initialPoints);

  const load = useCallback(async (d: number) => {
    const res = await fetch(`/api/net-worth/by-class?days=${d}`);
    const data = (await res.json()) as { points?: NetWorthByClassPoint[] };
    setPoints(data.points ?? []);
  }, []);

  useEffect(() => {
    if (days === initialDays) return;
    const timeout = setTimeout(() => load(days), 0);
    return () => clearTimeout(timeout);
  }, [days, initialDays, load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setDays(r.days)}
            className={clsx(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              days === r.days
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <NetWorthByClassChart points={points} />
    </div>
  );
}
