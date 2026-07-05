"use client";

import { useEffect } from "react";
import { TransactionsTable } from "@/components/transactions-table";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export function CategoryTransactionsModal({
  categoryId,
  categoryName,
  categoryIcon,
  monthLabel,
  from,
  to,
  categories,
  onClose,
}: {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  monthLabel: string;
  from: string;
  to: string;
  categories: Category[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-lg dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {categoryIcon} {categoryName}
            </h2>
            <p className="text-xs text-zinc-500">{monthLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          <TransactionsTable
            categories={categories}
            fixedCategoryId={categoryId}
            from={from}
            to={to}
          />
        </div>
      </div>
    </div>
  );
}
