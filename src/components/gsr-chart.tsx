"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDate } from "@/lib/format";
import { sliceByDays } from "@/lib/net-worth-range";

interface GsrPoint {
  date: string;
  ratio: number;
}

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: 36_500 },
];

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-zinc-400">{label ? formatDate(label) : ""}</p>
      <p className="font-medium text-zinc-50">{payload[0].value.toFixed(2)}</p>
    </div>
  );
}

/** Inline expandable chart of the gold/silver ratio (gold price / silver price, both
 *  USD per troy oz) over time -- how many ounces of silver one ounce of gold buys. */
export function GsrChart() {
  const [points, setPoints] = useState<GsrPoint[] | null>(null);
  const [days, setDays] = useState(365);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/spot-price/gsr/history`)
      .then((res) => res.json() as Promise<{ history?: GsrPoint[] }>)
      .then((data) => {
        if (!cancelled) setPoints(data.history ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sliced = useMemo(() => (points ? sliceByDays(points, days) : []), [points, days]);

  const latest = sliced[sliced.length - 1];
  const first = sliced[0];
  const delta = latest && first ? latest.ratio - first.ratio : 0;
  const percent = first && first.ratio !== 0 ? (delta / first.ratio) * 100 : 0;
  const isUp = delta >= 0;

  if (points === null) {
    return <p className="py-2 text-xs text-zinc-500">Loading GSR history...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {latest ? latest.ratio.toFixed(1) : "—"}
          <span className="ml-1 text-xs font-normal text-zinc-500">oz silver / oz gold</span>
        </p>
        {sliced.length >= 2 && (
          <span
            className="text-xs font-medium"
            style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}
          >
            {isUp ? "+" : "-"}
            {Math.abs(delta).toFixed(2)} ({Math.abs(percent).toFixed(2)}%)
          </span>
        )}
      </div>

      {sliced.length < 2 ? (
        <div className="flex h-32 items-center justify-center text-xs text-zinc-500">
          Not enough history yet -- check back after a few days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={sliced} margin={{ left: 0, right: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d)}
              tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
              minTickGap={40}
              stroke="var(--chart-axis)"
            />
            <YAxis
              tickFormatter={(v: number) => v.toFixed(0)}
              tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
              width={30}
              stroke="var(--chart-axis)"
              domain={["auto", "auto"]}
            />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="ratio"
              stroke="var(--chart-gsr)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex justify-between gap-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setDays(r.days)}
            className={clsx(
              "flex-1 rounded-full py-1 text-[11px] font-semibold transition-colors",
              days === r.days
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
