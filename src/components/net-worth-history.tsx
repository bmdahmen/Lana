"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { NetWorthByClassChart } from "@/components/net-worth-by-class-chart";
import { NET_WORTH_DISPLAY_CLASSES } from "@/lib/asset-classes";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  HISTORY_RANGES,
  sliceNetWorthPointsByDays,
  type NetWorthByClassPoint,
} from "@/lib/net-worth-range";

export function NetWorthHistory({
  initialPoints,
  initialDays,
}: {
  initialPoints: NetWorthByClassPoint[];
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);
  const [scrubPoint, setScrubPoint] = useState<NetWorthByClassPoint | null>(null);

  const points = useMemo(
    () => sliceNetWorthPointsByDays(initialPoints, days),
    [initialPoints, days]
  );

  const latest = points[points.length - 1];
  const displayPoint = scrubPoint ?? latest;
  const legend = displayPoint
    ? NET_WORTH_DISPLAY_CLASSES.filter((cls) => Number(displayPoint[cls.id] ?? 0) !== 0)
        .map((cls) => ({ ...cls, value: Number(displayPoint[cls.id] ?? 0) }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {HISTORY_RANGES.map((r) => (
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
      <NetWorthByClassChart points={points} onScrub={setScrubPoint} />
      {displayPoint && (
        <p className="text-xs text-zinc-500">
          {scrubPoint ? formatDate(scrubPoint.date) : `${formatDate(latest.date)} · latest`}
        </p>
      )}
      {legend.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
          {legend.map((cls) => (
            <li key={cls.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(${cls.colorVar})` }}
                />
                {cls.label}
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {formatCurrency(cls.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
