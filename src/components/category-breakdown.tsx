"use client";

import { useState } from "react";
import clsx from "clsx";
import type { AssetClass } from "@/lib/asset-classes";
import { formatCurrency, formatRelativeTime } from "@/lib/format";

interface ClassSummary {
  id: AssetClass;
  label: string;
  colorVar: string;
  value: number;
}

interface AccountSummary {
  id: string;
  name: string;
  asset_class: AssetClass;
  current_balance: number | null;
  mask: string | null;
  updated_at: string;
}

export function CategoryBreakdown({
  classes,
  accounts,
}: {
  classes: ClassSummary[];
  accounts: AccountSummary[];
}) {
  const [expanded, setExpanded] = useState<AssetClass | null>(null);

  const active = classes.find((c) => c.id === expanded);
  const activeAccounts = active
    ? accounts
        .filter((a) => a.asset_class === active.id)
        .sort((a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0))
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 sm:px-8">
        {classes.map((cls) => {
          const isActive = expanded === cls.id;
          return (
            <button
              key={cls.id}
              onClick={() => setExpanded(isActive ? null : cls.id)}
              aria-expanded={isActive}
              className={clsx(
                "flex min-w-[132px] shrink-0 flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
                isActive
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-900"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              )}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: `var(${cls.colorVar})` }}
                />
                {cls.label}
              </span>
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(cls.value)}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mx-4 overflow-hidden rounded-xl border border-zinc-200 bg-white sm:mx-8 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900">
            <span className="text-xs font-medium text-zinc-500">
              {activeAccounts.length} account{activeAccounts.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => setExpanded(null)}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Close
            </button>
          </div>
          {activeAccounts.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              No currently active accounts in this category — the total reflects carried-forward
              history from an account no longer counted toward today&apos;s balance.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {activeAccounts.map((acc) => (
              <li key={acc.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {acc.name}
                    {acc.mask && <span className="text-zinc-400"> •••• {acc.mask}</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Last checked {formatRelativeTime(acc.updated_at)}
                  </p>
                </div>
                <span className="shrink-0 pl-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(acc.current_balance ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
