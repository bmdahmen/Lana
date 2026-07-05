"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCachedFetch, setCachedFetch, invalidateCachedFetch } from "@/lib/client-cache";

const DEFAULT_TRANSACTIONS_CACHE_KEY = "transactions:default";
const PAGE_SIZE = 100;

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
  matchField: "merchant_name" | "name" | "both";
  matchType: "contains" | "equals";
  matchValue: string;
  categoryId: string;
}

export function TransactionsTable({
  categories,
  fixedCategoryId,
  from,
  to,
  defaultSort = "recent",
  collapsibleSearch = false,
  hideCategoryDropdown = false,
}: {
  categories: Category[];
  /** When set, results are locked to this category. Reactive: changing it (e.g. from a
   *  clickable category tile above this table) re-filters the list. */
  fixedCategoryId?: string;
  /** Optional fixed date range (inclusive), e.g. when embedded for a single month. */
  from?: string;
  to?: string;
  /** Initial sort order; user can still toggle via the Recent/Amount control. */
  defaultSort?: "recent" | "amount";
  /** Hide the search input behind a small icon toggle instead of always showing it. */
  collapsibleSearch?: boolean;
  /** Hide the built-in category dropdown, e.g. when category filtering is driven externally. */
  hideCategoryDropdown?: boolean;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(!collapsibleSearch);
  // Uncontrolled fallback for the built-in dropdown; ignored whenever
  // fixedCategoryId is provided, in which case that prop drives filtering
  // directly (reactively, so a parent's category-tile click re-filters).
  const [categoryFilterState, setCategoryFilterState] = useState("");
  const categoryFilter = fixedCategoryId !== undefined ? fixedCategoryId : categoryFilterState;
  const [sortMode, setSortMode] = useState<"recent" | "amount">(defaultSort);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  // Which mobile row's swipe-revealed category editor is expanded, if any.
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (sortMode !== "recent") params.set("sort", sortMode);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      return params;
    },
    [search, categoryFilter, from, to, sortMode]
  );

  const load = useCallback(async () => {
    const isDefaultView = !search && !categoryFilter && !from && !to && sortMode === "recent";

    if (isDefaultView) {
      const cached = getCachedFetch<Transaction[]>(DEFAULT_TRANSACTIONS_CACHE_KEY);
      if (cached) {
        setTransactions(cached);
        setHasMore(cached.length === PAGE_SIZE);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/transactions?${buildParams(0).toString()}`);
      const data = (await res.json()) as { transactions?: Transaction[] };
      const results = data.transactions ?? [];
      setTransactions(results);
      setHasMore(results.length === PAGE_SIZE);
      if (isDefaultView) {
        setCachedFetch(DEFAULT_TRANSACTIONS_CACHE_KEY, results);
      }
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, from, to, sortMode, buildParams]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/transactions?${buildParams(transactions.length).toString()}`);
      const data = (await res.json()) as { transactions?: Transaction[] };
      const results = data.transactions ?? [];
      setTransactions((prev) => [...prev, ...results]);
      setHasMore(results.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  async function updateCategory(id: string, categoryId: string) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category_id: categoryId } : t))
    );
    invalidateCachedFetch(DEFAULT_TRANSACTIONS_CACHE_KEY);
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
      // Default to requiring both fields when there's a merchant name to
      // match against -- more precise than either field alone, since a raw
      // description often contains extra noise (location, a trailing
      // reference number) that a plain "name"-only rule would need to avoid.
      matchField: tx.merchant_name ? "both" : "name",
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
      invalidateCachedFetch(DEFAULT_TRANSACTIONS_CACHE_KEY);
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
              <option value="both">merchant name &amp; description</option>
              <option value="merchant_name">merchant name</option>
              <option value="name">description</option>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
          {collapsibleSearch && !searchOpen ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search transactions"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <SearchIcon />
            </button>
          ) : (
            <input
              autoFocus={collapsibleSearch}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => {
                if (collapsibleSearch && !search) setSearchOpen(false);
              }}
              placeholder="Search transactions..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:w-64 dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
        </div>

        {!fixedCategoryId && !hideCategoryDropdown && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilterState(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-1 sm:ml-auto">
          {(["amount", "recent"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                sortMode === mode
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {mode === "amount" ? "Amount" : "Recent"}
            </button>
          ))}
        </div>
      </div>

      {ruleMessage && <p className="text-sm text-zinc-500">{ruleMessage}</p>}

      {!loading && transactions.length === 0 && (
        <p className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No transactions found.
        </p>
      )}

      {transactions.length > 0 && (
        <>
          {/* Mobile: card list. Each row is its own horizontal scroll-snap
              strip -- swiping left reveals the category-edit/create-rule
              icons instead of spending a whole extra row on them. */}
          <ul className="flex flex-col gap-1.5 md:hidden">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
                  <div className="flex w-full shrink-0 snap-start items-start gap-2.5 px-3 py-2.5">
                    <span className="mt-0.5 shrink-0 text-lg leading-none" aria-hidden>
                      {tx.category_icon ?? "❔"}
                    </span>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {tx.merchant_name ?? tx.name}
                          {tx.pending === 1 && (
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800">
                              Pending
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">
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
                  </div>
                  <div className="flex shrink-0 snap-end items-center gap-1 border-l border-zinc-100 px-3 dark:border-zinc-900">
                    <button
                      type="button"
                      aria-label="Edit category"
                      onClick={() => {
                        setRuleDraft(null);
                        setCategoryEditId(categoryEditId === tx.id ? null : tx.id);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <TagIcon />
                    </button>
                    <button
                      type="button"
                      aria-label="Create rule"
                      onClick={() => {
                        setCategoryEditId(null);
                        if (ruleDraft?.txId === tx.id) {
                          setRuleDraft(null);
                        } else {
                          openRuleForm(tx);
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
                {categoryEditId === tx.id && (
                  <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-900">
                    <select
                      autoFocus
                      value={tx.category_id ?? ""}
                      onChange={(e) => {
                        updateCategory(tx.id, e.target.value);
                        setCategoryEditId(null);
                      }}
                      className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-zinc-700"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {ruleDraft?.txId === tx.id && (
                  <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-900">
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

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.6 2.9 3 12.5V21h8.5l9.6-9.6a2 2 0 0 0 0-2.8l-5.7-5.7a2 2 0 0 0-2.8 0Z" />
      <circle cx="8.5" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
