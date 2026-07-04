import { getDB } from "@/lib/db";
import { SpendingBreakdown } from "@/components/spending-breakdown";

interface BreakdownRow {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  total: number;
  count: number;
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function SpendingPage() {
  const db = await getDB();
  const from = monthStart();

  const result = await db
    .prepare(
      `SELECT c.id as category_id, c.name as category_name, c.icon as category_icon,
              SUM(t.amount) as total, COUNT(*) as count
       FROM "transaction" t
       LEFT JOIN category c ON c.id = t.category_id
       WHERE t.category_id != 'cat_income' AND t.category_id != 'cat_transfer'
         AND t.amount > 0 AND t.date >= ?
       GROUP BY t.category_id
       ORDER BY total DESC`
    )
    .bind(from)
    .all<BreakdownRow>();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Spending</h1>
      <SpendingBreakdown initialBreakdown={result.results ?? []} initialFrom={from} />
    </div>
  );
}
