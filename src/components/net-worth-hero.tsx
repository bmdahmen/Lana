"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { NetWorthByClassPoint } from "@/lib/queries";

const RANGES: { label: string; days: number }[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "5Y", days: 1825 },
  { label: "All", days: 4400 },
];

export function NetWorthHero({
  initialPoints,
  initialDays,
}: {
  initialPoints: NetWorthByClassPoint[];
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);
  const [points, setPoints] = useState(initialPoints);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/net-worth/by-class?days=${d}`);
      const data = (await res.json()) as { points?: NetWorthByClassPoint[] };
      setPoints(data.points ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (days === initialDays) return;
    const timeout = setTimeout(() => load(days), 0);
    return () => clearTimeout(timeout);
  }, [days, initialDays, load]);

  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest && first ? latest.net_worth - first.net_worth : 0;
  const percent = first && first.net_worth !== 0 ? (delta / Math.abs(first.net_worth)) * 100 : 0;
  const isUp = delta >= 0;
  const trendColor = isUp ? "var(--positive)" : "var(--negative)";
  const rangeLabel = RANGES.find((r) => r.days === days)?.label ?? "";

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-zinc-500">Net Worth</p>
      <p className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        {formatCurrency(latest?.net_worth ?? 0)}
      </p>
      {points.length >= 2 && (
        <div
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: trendColor }}
        >
          <TrendArrow up={isUp} />
          <span>
            {isUp ? "+" : "-"}
            {formatCurrency(Math.abs(delta))} ({Math.abs(percent).toFixed(2)}%)
          </span>
          <span className="text-zinc-400 dark:text-zinc-600">{rangeLabel}</span>
        </div>
      )}

      <div className="mt-4" style={{ opacity: loading ? 0.6 : 1, transition: "opacity 150ms" }}>
        {points.length < 2 ? (
          <div className="flex h-52 items-center justify-center text-sm text-zinc-500">
            Not enough history yet — check back after a few days of syncing.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trendColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Net Worth"]}
                labelFormatter={(label) => formatDate(String(label))}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}
              />
              <Area
                type="monotone"
                dataKey="net_worth"
                stroke={trendColor}
                strokeWidth={2.5}
                fill="url(#netWorthFill)"
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: trendColor, strokeWidth: 2, fill: "var(--background)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 flex justify-between gap-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setDays(r.days)}
            className={clsx(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
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

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={up ? "" : "rotate-180"}
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}
