import { getDB } from "@/lib/db";
import { InvestmentsBreakdown } from "@/components/investments-breakdown";

interface BreakdownRow {
  account_id: string;
  account_name: string;
  asset_class: "brokerage" | "retirement" | "crypto";
  contributions: number;
  distributions: number;
  count: number;
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function InvestmentsPage() {
  const db = await getDB();
  const from = monthStart();

  const result = await db
    .prepare(
      `SELECT a.id as account_id, a.name as account_name, a.asset_class,
              SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END) as contributions,
              SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as distributions,
              COUNT(*) as count
       FROM "transaction" t
       JOIN account a ON a.id = t.account_id
       WHERE a.asset_class IN ('brokerage', 'retirement', 'crypto')
         AND a.is_closed = 0 AND a.is_hidden = 0
         AND t.date >= ?
       GROUP BY a.id
       HAVING contributions > 0 OR distributions > 0
       ORDER BY contributions DESC`
    )
    .bind(from)
    .all<BreakdownRow>();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Investments</h1>
      <InvestmentsBreakdown initialBreakdown={result.results ?? []} />
    </div>
  );
}
