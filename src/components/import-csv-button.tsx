"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Account {
  id: string;
  name: string;
}

export function ImportCsvButton({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [flipSign, setFlipSign] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("accountId", accountId);
      formData.append("flipSign", String(flipSign));

      const res = await fetch("/api/transactions/import-csv", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { imported?: number; skipped?: number; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Import failed.");
        return;
      }
      setMessage(`Imported ${data.imported ?? 0} transaction(s), skipped ${data.skipped ?? 0} duplicate(s).`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (accounts.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Import CSV
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-950">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Import transactions from CSV
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Account
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  CSV file
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={flipSign}
                  onChange={(e) => setFlipSign(e.target.checked)}
                />
                Amounts look backwards after import (flip sign)
              </label>
              {message && <p className="text-sm text-zinc-500">{message}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
                >
                  {submitting ? "Importing..." : "Import"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
