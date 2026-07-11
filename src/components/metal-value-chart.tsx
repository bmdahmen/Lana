"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import type { MetalValuePoint } from "@/lib/metal-items";

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: 36_500 },
];

function sliceByDays(points: MetalValuePoint[], days: number): MetalValuePoint[] {
  if (points.length === 0) return points;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const cutoffIndex = points.findIndex((p) => p.date >= cutoffDate);
  if (cutoffIndex <= 0) return points;
  return points.slice(cutoffIndex - 1);
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const gold = payload.find((p) => p.dataKey === "gold")?.value ?? 0;
  const silver = payload.find((p) => p.dataKey === "silver")?.value ?? 0;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-zinc-400">
        {label ? formatDate(new Date(label).toISOString().slice(0, 10)) : ""}
      </p>
      <p style={{ color: "var(--chart-gold)" }}>Gold {formatCurrency(gold)}</p>
      <p style={{ color: "var(--chart-silver)" }}>Silver {formatCurrency(silver)}</p>
      <p className="mt-1 font-medium text-zinc-50">Total {formatCurrency(gold + silver)}</p>
    </div>
  );
}

export function MetalValueChart({ points }: { points: MetalValuePoint[] }) {
  const [days, setDays] = useState(365);
  const sliced = useMemo(() => sliceByDays(points, days), [points, days]);
  // History is often monthly-granularity in the past and daily going
  // forward -- a plain category axis would space every point evenly
  // regardless of the actual gap between dates. A numeric time scale keyed
  // off each point's real timestamp makes the x axis honor actual elapsed
  // time (see the same fix on the net worth chart).
  const timedPoints = useMemo(
    () => sliced.map((p) => ({ ...p, _ts: new Date(`${p.date}T00:00:00Z`).getTime() })),
    [sliced]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setDays(r.days)}
            className={clsx(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors sm:flex-none sm:px-4",
              days === r.days
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {sliced.length < 2 ? (
        <div className="flex h-60 items-center justify-center text-sm text-zinc-500">
          Not enough history yet — check back after a few days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timedPoints} margin={{ left: -16, right: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="_ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) => formatDate(new Date(t).toISOString().slice(0, 10))}
              tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
              minTickGap={40}
              stroke="var(--chart-axis)"
            />
            <YAxis
              tickFormatter={(v: number) => formatCompactCurrency(v)}
              tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
              width={48}
              stroke="var(--chart-axis)"
            />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="gold"
              name="Gold"
              stroke="var(--chart-gold)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="silver"
              name="Silver"
              stroke="var(--chart-silver)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
