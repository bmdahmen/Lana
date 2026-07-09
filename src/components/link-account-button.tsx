"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import clsx from "clsx";
import { OWNERS, type Owner } from "@/lib/owners";

export function LinkAccountButton({ defaultOwner = "brian" }: { defaultOwner?: Owner }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<Owner>(defaultOwner);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setLoading(true);
      try {
        await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id ?? null,
            institutionName: metadata.institution?.name ?? null,
            owner,
          }),
        });
        router.refresh();
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    [router, owner]
  );

  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
  });

  async function startLink() {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner }),
      });
      const data = (await res.json()) as { linkToken: string };
      setLinkToken(data.linkToken);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (linkToken && ready) {
    openPlaidLink();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? "Loading..." : "Link an account"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-950">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Link an account
            </h2>
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Whose account is this?
            </p>
            <div className="mb-6 flex gap-2">
              {OWNERS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOwner(o.id)}
                  className={clsx(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    owner === o.id
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startLink}
                disabled={loading}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
              >
                {loading ? "Loading..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
