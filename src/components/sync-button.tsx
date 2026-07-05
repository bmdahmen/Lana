"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

export function SyncButton({ className }: { className?: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const onClick = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/net-worth/recompute", { method: "POST" });
    } catch {
      // Best-effort -- the button just stops spinning either way.
    } finally {
      setSyncing(false);
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncing}
      aria-label="Sync accounts"
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-400",
        className
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={syncing ? "animate-spin" : undefined}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
