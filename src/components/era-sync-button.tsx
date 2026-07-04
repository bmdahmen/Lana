"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EraSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/era/sync", { method: "POST" });
      const data = (await res.json()) as { synced?: number; skipped?: number; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Sync failed.");
        return;
      }
      setMessage(
        `Synced ${data.synced ?? 0} account(s)` +
          (data.skipped ? `, ${data.skipped} not yet visible on your Era plan.` : ".")
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={sync}
        disabled={loading}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {loading ? "Syncing..." : "Sync from Era"}
      </button>
      {message && <p className="text-xs text-zinc-500">{message}</p>}
    </div>
  );
}
