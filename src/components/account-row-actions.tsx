"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PreciousMetal } from "@/lib/asset-classes";

export function AccountRowActions({
  accountId,
  isHidden,
  isManual,
  preciousMetal,
}: {
  accountId: string;
  isHidden: boolean;
  isManual: boolean;
  preciousMetal?: PreciousMetal | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSubmitting(true);
    try {
      await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex justify-end gap-3 text-xs">
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
      {isManual && !preciousMetal && (
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
