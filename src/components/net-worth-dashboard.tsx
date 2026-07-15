"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { NetWorthByClassChart } from "@/components/net-worth-by-class-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { NET_WORTH_DISPLAY_CLASSES, type AssetClass } from "@/lib/asset-classes";
import { OWNERS, type Owner } from "@/lib/owners";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  HOME_RANGES,
  sliceNetWorthPointsByDays,
  type NetWorthByClassPoint,
} from "@/lib/net-worth-range";

type OwnerFilter = Owner | "family";

const OWNER_FILTERS: { id: OwnerFilter; label: string }[] = [
  { id: "family", label: "Family" },
  ...OWNERS.map((o) => ({ id: o.id as OwnerFilter, label: o.label })),
];

interface AccountSummary {
  id: string;
  name: string;
  asset_class: AssetClass;
  current_balance: number | null;
  mask: string | null;
  updated_at: string;
  owner: Owner;
}

export function NetWorthDashboard({
  initialPoints,
  initialDays,
  accounts,
}: {
  initialPoints: NetWorthByClassPoint[];
  initialDays: number;
  accounts: AccountSummary[];
}) {
  const [days, setDays] = useState(initialDays);
  const [owner, setOwner] = useState<OwnerFilter>("family");
  const [scrubPoint, setScrubPoint] = useState<NetWorthByClassPoint | null>(null);

  const slicedPoints = useMemo(
    () => sliceNetWorthPointsByDays(initialPoints, days),
    [initialPoints, days]
  );

  // Same owner-remap as the /net-worth exploration page: swap each point's
  // net_worth and class fields for that owner's scoped value, so the hero
  // number, delta, and chart all just read the plain fields without needing
  // to know owner filtering happened.
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

  const latest = points[points.length - 1];
  const first = points[0];
  const displayPoint = scrubPoint ?? latest;

  const delta = latest && first ? latest.net_worth - first.net_worth : 0;
  const percent = first && first.net_worth !== 0 ? (delta / Math.abs(first.net_worth)) * 100 : 0;
  const isUp = delta >= 0;
  const trendColor = isUp ? "var(--positive)" : "var(--negative)";
  const rangeLabel = HOME_RANGES.find((r) => r.days === days)?.label ?? "";

  // Scoped to the same owner as the toggle above -- displayPoint already
  // carries owner-remapped class values, so this just reads them straight
  // through. The account list below is filtered to match (scopedAccounts),
  // so the tiles and the list always agree.
  const classBreakdown = displayPoint
    ? NET_WORTH_DISPLAY_CLASSES.filter((cls) => Number(displayPoint[cls.id] ?? 0) !== 0)
        .map((cls) => ({
          ...cls,
          value: Number(displayPoint[cls.id] ?? 0),
        }))
        .sort((a, b) => b.value - a.value)
    : [];
  const scopedAccounts = owner === "family" ? accounts : accounts.filter((a) => a.owner === owner);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 px-4 pt-4 pb-6 sm:px-8">
        <p className="text-sm font-medium text-zinc-500">Net Worth</p>
        <p className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          {formatCurrency(displayPoint?.net_worth ?? 0)}
        </p>
        {scrubPoint ? (
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-600">
            {formatDate(scrubPoint.date)}
          </p>
        ) : (
          points.length >= 2 && (
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
          )
        )}

        <div className="mt-4 flex gap-1">
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

        <div className="mt-4">
          {points.length < 2 ? (
            <div className="flex h-52 items-center justify-center text-sm text-zinc-500">
              Not enough history yet — check back after a few days of syncing.
            </div>
          ) : (
            <NetWorthByClassChart points={points} onScrub={setScrubPoint} />
          )}
        </div>

        <div className="mt-2 flex justify-between gap-1">
          {HOME_RANGES.map((r) => (
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

      {classBreakdown.length > 0 && (
        <section className="pb-6">
          <div className="mb-3 flex items-baseline justify-between px-4 sm:px-8">
            <h2 className="text-sm font-medium text-zinc-500">By category</h2>
            <Link
              href="/net-worth"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Explore by account →
            </Link>
          </div>
          <CategoryBreakdown classes={classBreakdown} accounts={scopedAccounts} />
        </section>
      )}
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
