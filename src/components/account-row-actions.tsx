"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PreciousMetal } from "@/lib/asset-classes";

export function AccountRowActions({
  accountId,
  isHidden,
  isManual,
  preciousMetal,
  isHistorical,
  propertyAddress,
}: {
  accountId: string;
  isHidden: boolean;
  isManual: boolean;
  preciousMetal?: PreciousMetal | null;
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
      {isManual && !preciousMetal && !propertyAddress && (
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
            if (
              confirm(
                "Mark historical? Its balance history stays in the net worth chart, but it stops counting toward today's totals -- use this instead of Close when a real linked account now covers the same category."
              )
            ) {
              patch({ relevantUntil: new Date().toISOString().slice(0, 10) });
            }
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
