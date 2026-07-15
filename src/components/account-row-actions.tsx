"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PreciousMetal, Cryptocurrency } from "@/lib/asset-classes";

export function AccountRowActions({
  accountId,
  isHidden,
  isManual,
  preciousMetal,
  cryptoSymbol,
  isHistorical,
  propertyAddress,
}: {
  accountId: string;
  isHidden: boolean;
  isManual: boolean;
  preciousMetal?: PreciousMetal | null;
  cryptoSymbol?: Cryptocurrency | null;
  isHistorical?: boolean;
  propertyAddress?: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(data?.error ?? "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-3 text-xs">
      <button
        disabled={submitting}
        onClick={() => patch({ isHidden: !isHidden })}
        className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
      >
        {isHidden ? "Unhide" : "Hide"}
      </button>
      {isManual && preciousMetal && (
        <button
          disabled={submitting}
          onClick={() => {
            const value = prompt(`New amount (troy oz of ${preciousMetal})`);
            if (value !== null && !Number.isNaN(Number(value)) && Number(value) > 0) {
              patch({ metalTroyOz: Number(value) });
            }
          }}
          className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          Update ounces
        </button>
      )}
      {isManual && cryptoSymbol && (
        <button
          disabled={submitting}
          onClick={() => {
            const value = prompt(`New amount of ${cryptoSymbol.toUpperCase()}`);
            if (value !== null && !Number.isNaN(Number(value)) && Number(value) > 0) {
              patch({ cryptoAmount: Number(value) });
            }
          }}
          className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          Update amount
        </button>
      )}
      {isManual && propertyAddress !== undefined && propertyAddress !== null && (
        <button
          disabled={submitting}
          onClick={() => {
            const value = prompt("Property address", propertyAddress);
            if (value !== null && value.trim() !== "") {
              patch({ propertyAddress: value.trim() });
            }
          }}
          className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          Update address
        </button>
      )}
      {isManual && !preciousMetal && !cryptoSymbol && !propertyAddress && (
        <button
          disabled={submitting}
          onClick={() => {
            const value = prompt("New balance");
            if (value !== null && !Number.isNaN(Number(value))) {
              patch({ currentBalance: Number(value) });
            }
          }}
          className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          Update balance
        </button>
      )}
      {isManual && (
        <button
          disabled={submitting}
          onClick={() => {
            if (isHistorical) {
              patch({ relevantUntil: null, relevantFrom: null });
              return;
            }
            const today = new Date().toISOString().slice(0, 10);
            const value = prompt(
              "Mark historical as of what date? Its balance history stays in the net worth chart, but it stops counting toward totals from this date on -- use this instead of Close when a real linked account now covers the same category.",
              today
            );
            if (value === null) return;
            const trimmed = value.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
              alert("Enter a date as YYYY-MM-DD");
              return;
            }
            patch({ relevantUntil: trimmed });
          }}
          className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          {isHistorical ? "Clear historical" : "Mark historical"}
        </button>
      )}
      <button
        disabled={submitting}
        onClick={() => {
          if (confirm("Close this account? It will be removed from balances and net worth.")) {
            patch({ isClosed: true });
          }
        }}
        className="text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        Close
      </button>
    </div>
  );
}
