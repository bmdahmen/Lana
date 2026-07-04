"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountRowActions({
  accountId,
  isHidden,
  isManual,
}: {
  accountId: string;
  isHidden: boolean;
  isManual: boolean;
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
      {isManual && (
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
