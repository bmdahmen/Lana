"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Transaction {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  pending: number;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
}

interface RuleDraft {
  txId: string;
  matchField: "merchant_name" | "name";
  matchType: "contains" | "equals";
  matchValue: string;
  categoryId: string;
}

export function TransactionsTable({ categories }: { categories: Category[] }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = (await res.json()) as { transactions?: Transaction[] };
      setTransactions(data.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  async function updateCategory(id: string, categoryId: string) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category_id: categoryId } : t))
    );
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
  }

  function openRuleForm(tx: Transaction) {
    setRuleMessage(null);
    setRuleDraft({
      txId: tx.id,
      matchField: tx.merchant_name ? "merchant_name" : "name",
      matchValue: tx.merchant_name ?? tx.name,
      matchType: "contains",
      categoryId: tx.category_id ?? categories[0]?.id ?? "",
    });
  }

  async function submitRule() {
    if (!ruleDraft || !ruleDraft.matchValue.trim() || !ruleDraft.categoryId) return;
    setRuleSubmitting(true);
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchField: ruleDraft.matchField,
          matchType: ruleDraft.matchType,
          matchValue: ruleDraft.matchValue.trim(),
          categoryId: ruleDraft.categoryId,
        }),
      });
      const applyRes = await fetch("/api/rules/apply", { method: "POST" });
      const applyData = (await applyRes.json()) as { updated?: number };
      setRuleDraft(null);
      setRuleMessage(
        `Rule created. Recategorized ${applyData.updated ?? 0} matching transaction${
          applyData.updated === 1 ? "" : "s"
        }.`
      );
      await load();
    } finally {
      setRuleSubmitting(false);
    }
  }

  function RuleDraftForm() {
    if (!ruleDraft) return null;
    return (
      <div className="flex flex-col gap-3 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">If</label>
            <select
              value={ruleDraft.matchField}
              onChange={(e) =>
                setRuleDraft({
                  ...ruleDraft,
                  matchField: e.target.value as RuleDraft["matchField"],
                })
              }
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="name">description</option>
              <option value="merchant_name">merchant name</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Match</label>
            <select
              value={ruleDraft.matchType}
              onChange={(e) =>
                setRuleDraft({
                  ...ruleDraft,
                  matchType: e.target.value as RuleDraft["matchType"],
                })
              }
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="contains">contains</option>
              <option value="equals">equals</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Value</label>
            <input
              value={ruleDraft.matchValue}
              onChange={(e) => setRuleDraft({ ...ruleDraft, matchValue: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:w-64 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Always categorize as</label>
            <select
              value={ruleDraft.categoryId}
              onChange={(e) => setRuleDraft({ ...ruleDraft, categoryId: e.target.value })}
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={submitRule}
            disabled={ruleSubmitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Create rule
          </button>
          <button
            onClick={() => setRuleDraft(null)}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          This will apply to this and any other matching transactions now, and to new
          transactions going forward.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactions..."
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:w-64 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {ruleMessage && <p className="text-sm text-zinc-500">{ruleMessage}</p>}

      {!loading && transactions.length === 0 && (
        <p className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No transactions found.
        </p>
      )}

      {transactions.length > 0 && (
        <>
          {/* Mobile: card list */}
          <ul className="flex flex-col gap-3 md:hidden">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {tx.merchant_name ?? tx.name}
                      {tx.pending === 1 && (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800">
                          Pending
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {tx.account_name} · {formatDate(tx.date)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-medium"
                    style={tx.amount > 0 ? undefined : { color: "var(--positive)" }}
                  >
                    {tx.amount > 0 ? "-" : "+"}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={tx.category_id ?? ""}
                    onChange={(e) => updateCategory(tx.id, e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-xs outline-none dark:border-zinc-700"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      ruleDraft?.txId === tx.id ? setRuleDraft(null) : openRuleForm(tx)
                    }
                    className="shrink-0 whitespace-nowrap text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    + rule
                  </button>
                </div>
                {ruleDraft?.txId === tx.id && (
                  <div className="mt-3">
                    <RuleDraftForm />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {transactions.map((tx) => (
                  <Fragment key={tx.id}>
                    <tr>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {tx.merchant_name ?? tx.name}
                        </span>
                        {tx.pending === 1 && (
                          <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {tx.account_name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={tx.category_id ?? ""}
                            onChange={(e) => updateCategory(tx.id, e.target.value)}
                            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-zinc-700"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.icon} {c.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              ruleDraft?.txId === tx.id ? setRuleDraft(null) : openRuleForm(tx)
                            }
                            className="whitespace-nowrap text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                          >
                            + rule
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-50">
                        {tx.amount > 0 ? "-" : "+"}
                        {formatCurrency(Math.abs(tx.amount))}
                      </td>
                    </tr>
                    {ruleDraft?.txId === tx.id && (
                      <tr>
                        <td colSpan={5} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                          <RuleDraftForm />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
