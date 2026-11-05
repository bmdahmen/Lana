import Link from "next/link";
import { getDB } from "@/lib/db";
import { getNetWorthSeries, getAccountBalanceHistory, type NetWorthByClassPoint, type AccountBalanceHistory } from "@/lib/queries";
import { type AssetClass } from "@/lib/asset-classes";
import type { Owner } from "@/lib/owners";
import { HOME_RANGES } from "@/lib/net-worth-range";
import { formatCurrency, formatDate } from "@/lib/format";
import { NetWorthDashboard } from "@/components/net-worth-dashboard";
import { getCached, CACHE_KEYS } from "@/lib/cache";
import { getSession } from "@/lib/session";

const HERO_DEFAULT_DAYS = HOME_RANGES.find((r) => r.label === "5Y")?.days ?? 1825;

interface RecentTransaction {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  account_name: string;
  category_name: string | null;
  category_icon: string | null;
}

interface AccountSummaryRow {
  id: string;
  name: string;
  asset_class: AssetClass;
  current_balance: number | null;
  mask: string | null;
  updated_at: string;
  owner: Owner;
  relevant_until: string | null;
}

interface DashboardData {
  byClassPoints: NetWorthByClassPoint[];
  accountHistory: AccountBalanceHistory;
  accountCount: number;
  recentTransactions: RecentTransaction[];
  accountsByClass: AccountSummaryRow[];
}

export default async function DashboardPage() {
  const db = await getDB();
  const session = await getSession();
  const isGuest = session.role === "guest";

  const { byClassPoints, accountHistory, accountCount, recentTransactions, accountsByClass } = await getCached(
    CACHE_KEYS.homeDashboard,
    async (): Promise<DashboardData> => {
      const [byClassPoints, accountHistory, accountCountRow, recentResult, accountsResult] = await Promise.all([
        getNetWorthSeries(db),
        getAccountBalanceHistory(db),
        db
          .prepare("SELECT COUNT(*) as count FROM account WHERE is_closed = 0")
          .first<{ count: number }>(),
        db
          .prepare(
            `SELECT t.id, t.name, t.merchant_name, t.amount, t.date, a.name as account_name,
                    c.name as category_name, c.icon as category_icon
             FROM "transaction" t
             JOIN account a ON a.id = t.account_id
             LEFT JOIN category c ON c.id = t.category_id
             ORDER BY t.date DESC, t.created_at DESC
             LIMIT 8`
          )
          .all<RecentTransaction>(),
        db
          .prepare(
            `SELECT id, name, asset_class, current_balance, mask, updated_at, owner, relevant_until FROM account
             WHERE is_closed = 0 AND is_hidden = 0
             ORDER BY current_balance DESC`
          )
          .all<AccountSummaryRow>(),
      ]);

      return {
        byClassPoints,
        accountHistory,
        accountCount: accountCountRow?.count ?? 0,
        recentTransactions: recentResult.results ?? [],
        accountsByClass: accountsResult.results ?? [],
      };
    }
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <NetWorthDashboard
        initialPoints={byClassPoints}
        initialDays={HERO_DEFAULT_DAYS}
        accounts={accountsByClass}
        accountHistory={accountHistory}
      />

      <section className="px-4 pb-8 sm:px-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500">Recent Activity</h2>
          <Link
            href="/spending"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            See all
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {isGuest ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Transaction line items are hidden in guest view.
            </p>
          ) : recentTransactions.length === 0 ? (
            <EmptyState accountCount={accountCount} />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
              {recentTransactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-lg">{tx.category_icon ?? "❔"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {tx.merchant_name ?? tx.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {tx.account_name} · {formatDate(tx.date)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      tx.amount > 0
                        ? "shrink-0 pl-2 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                        : "shrink-0 pl-2 text-sm font-medium"
                    }
                    style={tx.amount > 0 ? undefined : { color: "var(--positive)" }}
                  >
                    {tx.amount > 0 ? "-" : "+"}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ accountCount }: { accountCount: number }) {
  return (
    <p className="py-8 text-center text-sm text-zinc-500">
      {accountCount === 0 ? (
        <>
          Link your first account from{" "}
          <Link href="/accounts" className="underline underline-offset-2">
            Accounts
          </Link>{" "}
          to start tracking your finances.
        </>
      ) : (
        "No transactions yet — they'll show up here after your first sync."
      )}
    </p>
  );
}
