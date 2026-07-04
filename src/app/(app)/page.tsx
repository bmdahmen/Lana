import { getDB } from "@/lib/db";
import { recomputeNetWorth } from "@/lib/sync";
import { getNetWorthByClass } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { NetWorthByClassChart } from "@/components/net-worth-by-class-chart";
import { LinkAccountButton } from "@/components/link-account-button";
import { LinkMxAccountButton } from "@/components/link-mx-account-button";

interface Snapshot {
  date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
}

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

export default async function DashboardPage() {
  const db = await getDB();
  await recomputeNetWorth(db);

  const snapshotResult = await db
    .prepare(
      `SELECT date, total_assets, total_liabilities, net_worth
       FROM net_worth_snapshot ORDER BY date DESC LIMIT 90`
    )
    .all<Snapshot>();
  const snapshots = (snapshotResult.results ?? []).slice().reverse();
  const latest = snapshots[snapshots.length - 1];

  const byClassPoints = await getNetWorthByClass(db, 90);

  const accountCount = await db
    .prepare("SELECT COUNT(*) as count FROM account WHERE is_closed = 0")
    .first<{ count: number }>();

  const recentResult = await db
    .prepare(
      `SELECT t.id, t.name, t.merchant_name, t.amount, t.date, a.name as account_name,
              c.name as category_name, c.icon as category_icon
       FROM "transaction" t
       JOIN account a ON a.id = t.account_id
       LEFT JOIN category c ON c.id = t.category_id
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT 8`
    )
    .all<RecentTransaction>();
  const recentTransactions = recentResult.results ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <div className="flex gap-2">
          <LinkAccountButton />
          <LinkMxAccountButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Net Worth" value={latest?.net_worth ?? 0} />
        <SummaryCard label="Assets" value={latest?.total_assets ?? 0} />
        <SummaryCard label="Liabilities" value={latest?.total_liabilities ?? 0} negative />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-medium text-zinc-500">Net Worth by Category</h2>
        <NetWorthByClassChart points={byClassPoints} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-medium text-zinc-500">Recent Transactions</h2>
        {recentTransactions.length === 0 ? (
          <EmptyState accountCount={accountCount?.count ?? 0} />
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {recentTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{tx.category_icon ?? "❔"}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {tx.merchant_name ?? tx.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {tx.account_name} · {formatDate(tx.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={
                    tx.amount > 0
                      ? "text-sm font-medium text-zinc-900 dark:text-zinc-50"
                      : "text-sm font-medium text-emerald-600"
                  }
                >
                  {tx.amount > 0 ? "-" : "+"}
                  {formatCurrency(Math.abs(tx.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm text-zinc-500">{label}</p>
      <p
        className={
          negative
            ? "mt-1 text-2xl font-semibold text-red-600"
            : "mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
        }
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function EmptyState({ accountCount }: { accountCount: number }) {
  return (
    <p className="py-8 text-center text-sm text-zinc-500">
      {accountCount === 0
        ? "Link your first account to start tracking your finances."
        : "No transactions yet — they'll show up here after your first sync."}
    </p>
  );
}
