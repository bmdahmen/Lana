"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { NetWorthByClassChart } from "@/components/net-worth-by-class-chart";
import { NET_WORTH_DISPLAY_CLASSES } from "@/lib/asset-classes";
import { OWNERS, type Owner } from "@/lib/owners";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  HISTORY_RANGES,
  sliceNetWorthPointsByDays,
  type NetWorthByClassPoint,
} from "@/lib/net-worth-range";

const NET_WORTH_KEY = "net_worth";

type OwnerFilter = Owner | "family";

const OWNER_FILTERS: { id: OwnerFilter; label: string }[] = [
  { id: "family", label: "Family" },
  ...OWNERS.map((o) => ({ id: o.id as OwnerFilter, label: o.label })),
];

export function NetWorthHistory({
  initialPoints,
  initialDays,
}: {
  initialPoints: NetWorthByClassPoint[];
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);
  const [owner, setOwner] = useState<OwnerFilter>("family");
  const [scrubPoint, setScrubPoint] = useState<NetWorthByClassPoint | null>(null);
  // null means "everything visible" (the default); once the user toggles
  // anything, this becomes the explicit set of visible line keys.
  const [selectionOverride, setSelectionOverride] = useState<Set<string> | null>(null);

  const slicedPoints = useMemo(
    () => sliceNetWorthPointsByDays(initialPoints, days),
    [initialPoints, days]
  );

  // Owner filtering swaps each class (and the net-worth total) for its
  // owner-scoped value computed server-side (see queries.ts's ownerKey) --
  // everything downstream keeps reading the plain class/net_worth fields
  // and doesn't need to know owner filtering happened at all.
  const points = useMemo<NetWorthByClassPoint[]>(() => {
    if (owner === "family") return slicedPoints;
    return slicedPoints.map((p): NetWorthByClassPoint => {
      const next: NetWorthByClassPoint = { ...p, net_worth: Number(p[`net_worth:${owner}`] ?? 0) };
      for (const cls of NET_WORTH_DISPLAY_CLASSES) {
        next[cls.id] = Number(p[`${cls.id}:${owner}`] ?? 0);
      }
      return next;
    });
  }, [slicedPoints, owner]);

  const availableClasses = useMemo(
    () => NET_WORTH_DISPLAY_CLASSES.filter((cls) => points.some((p) => Number(p[cls.id] ?? 0) !== 0)),
    [points]
  );
  const allKeys = useMemo(
    () => [NET_WORTH_KEY, ...availableClasses.map((c) => c.id)],
    [availableClasses]
  );
  const selectedKeys = useMemo(
    () => selectionOverride ?? new Set(allKeys),
    [selectionOverride, allKeys]
  );

  // Whether the user has deselected at least one asset class (as opposed to
  // just toggling the total line itself) -- this is what flips the summary
  // row from the true Net Worth to a Net Combined of only what's selected.
  const isFiltered = availableClasses.some((cls) => !selectedKeys.has(cls.id));
  const totalLabel = isFiltered ? "Net Combined" : "Net Worth";

  // The chart reads its total line from each point's `net_worth` field, so
  // when filtered we swap that field for the sum of only the selected
  // classes -- everything downstream (scrub, latest, legend) then just works
  // off this series without needing to special-case the combined value.
  const chartPoints = useMemo<NetWorthByClassPoint[]>(() => {
    if (!isFiltered) return points;
    return points.map((p): NetWorthByClassPoint => {
      let combined = 0;
      for (const cls of availableClasses) {
        if (selectedKeys.has(cls.id)) combined += Number(p[cls.id] ?? 0);
      }
      return { ...p, net_worth: combined };
    });
  }, [points, isFiltered, availableClasses, selectedKeys]);

  function toggleKey(key: string) {
    setSelectionOverride((prev) => {
      const base = prev ?? new Set(allKeys);
      const next = new Set(base);
      if (next.has(key)) {
        // Keep at least one line visible -- an empty chart gives no feedback.
        if (next.size === 1) return base;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const latest = chartPoints[chartPoints.length - 1];
  const displayPoint = scrubPoint ?? latest;
  const legend = displayPoint
    ? [
        { id: NET_WORTH_KEY, label: totalLabel, colorVar: "--chart-net-worth", value: displayPoint.net_worth },
        ...availableClasses.map((cls) => ({ ...cls, value: Number(displayPoint[cls.id] ?? 0) })),
      ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {OWNER_FILTERS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOwner(o.id)}
            className={clsx(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors sm:flex-none sm:px-4",
              owner === o.id
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
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
      <NetWorthByClassChart
        points={chartPoints}
        onScrub={setScrubPoint}
        visibleKeys={selectedKeys}
        totalLabel={totalLabel}
      />
      {displayPoint && (
        <p className="text-xs text-zinc-500">
          {scrubPoint ? formatDate(scrubPoint.date) : `${formatDate(latest.date)} · latest`}
        </p>
      )}
      {legend.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
          {legend.map((cls) => {
            const isVisible = selectedKeys.has(cls.id);
            return (
              <li key={cls.id}>
                <button
                  type="button"
                  onClick={() => toggleKey(cls.id)}
                  aria-pressed={isVisible}
                  className="flex w-full items-center justify-between py-2.5 text-sm"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2",
                      isVisible ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-300 dark:text-zinc-700"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full transition-opacity"
                      style={{
                        backgroundColor: `var(${cls.colorVar})`,
                        opacity: isVisible ? 1 : 0.3,
                      }}
                    />
                    {cls.label}
                  </span>
                  <span
                    className={clsx(
                      "font-medium",
                      isVisible ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-300 dark:text-zinc-700"
                    )}
                  >
                    {formatCurrency(cls.value)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
