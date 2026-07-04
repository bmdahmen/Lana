"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSET_CLASSES, type AssetClass } from "@/lib/asset-classes";

// Precious metals accounts carry troy-oz/spot-price fields that only the
// "Add manual account" flow sets up, so they're not a valid retarget here.
const SELECTABLE_CLASSES = ASSET_CLASSES.filter((c) => c.id !== "precious_metals");

export function AccountCategorySelect({
  accountId,
  assetClass,
}: {
  accountId: string;
  assetClass: AssetClass;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function updateClass(next: string) {
    setSubmitting(true);
    try {
      await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetClass: next }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <select
      value={assetClass}
      disabled={submitting}
      onChange={(e) => updateClass(e.target.value)}
      className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-600 outline-none disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
    >
      {SELECTABLE_CLASSES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
      {assetClass === "precious_metals" && (
        <option value="precious_metals">Precious Metals</option>
      )}
    </select>
  );
}
