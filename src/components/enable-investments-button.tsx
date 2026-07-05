"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

/** Grants Plaid's Investments product consent to an already-linked brokerage/
 *  retirement/crypto item via Link's update mode -- needed because these
 *  items were originally linked with only the Transactions product, which
 *  never returns buy/sell/cash activity for investment accounts. */
export function EnableInvestmentsButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSuccess = useCallback(async () => {
    setLoading(true);
    try {
      // Update mode doesn't issue a new access token to exchange -- the
      // existing item's token already reflects the added consent. Just
      // re-sync so the newly-available investment transactions get pulled in.
      await fetch("/api/plaid/sync", { method: "POST" });
      setDone(true);
      router.refresh();
    } finally {
      setLoading(false);
      setLinkToken(null);
    }
  }, [router]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
  });

  async function startLink() {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = (await res.json()) as { linkToken?: string; error?: string };
      if (!data.linkToken) {
        alert(data.error ?? "Couldn't start Plaid Link");
        setLoading(false);
        return;
      }
      setLinkToken(data.linkToken);
    } finally {
      setLoading(false);
    }
  }

  if (linkToken && ready) {
    open();
  }

  if (done) {
    return <span className="text-xs text-zinc-400">Investments enabled</span>;
  }

  return (
    <button
      type="button"
      onClick={startLink}
      disabled={loading}
      className="text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
    >
      {loading ? "Loading..." : "Enable investment transactions"}
    </button>
  );
}
