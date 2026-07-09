"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OWNERS, type Owner } from "@/lib/owners";

export function AccountOwnerSelect({ accountId, owner }: { accountId: string; owner: Owner }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function updateOwner(next: string) {
    setSubmitting(true);
    try {
      await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: next }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <select
      value={owner}
      disabled={submitting}
      onChange={(e) => updateOwner(e.target.value)}
      className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-600 outline-none disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
    >
      {OWNERS.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
