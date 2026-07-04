"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ASSET_CLASSES } from "@/lib/asset-classes";
import { formatCurrency, formatDate } from "@/lib/format";
import type { NetWorthByClassPoint } from "@/lib/queries";

export function NetWorthByClassChart({ points }: { points: NetWorthByClassPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
        Not enough history yet — check back after a few days of syncing.
      </div>
    );
  }

  const activeClasses = ASSET_CLASSES.filter((cls) =>
    points.some((p) => Number(p[cls.id] ?? 0) !== 0)
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={points}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatDate(d)}
          tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
          minTickGap={40}
          stroke="var(--chart-axis)"
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v).replace(".00", "")}
          tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
          width={80}
          stroke="var(--chart-axis)"
        />
        <Tooltip
          formatter={(value, name) => [formatCurrency(Number(value)), name]}
          labelFormatter={(label) => formatDate(String(label))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="net_worth"
          name="Net Worth"
          stroke="var(--chart-net-worth)"
          strokeWidth={3}
          dot={false}
        />
        {activeClasses.map((cls) => (
          <Line
            key={cls.id}
            type="monotone"
            dataKey={cls.id}
            name={cls.label}
            stroke={`var(${cls.colorVar})`}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
