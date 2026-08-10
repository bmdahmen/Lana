import { getDB } from "@/lib/db";
import { SpendingBreakdown } from "@/components/spending-breakdown";
import { getSession } from "@/lib/session";

interface BreakdownRow {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  total: number;
  count: number;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function SpendingPage() {
  const db = await getDB();
  const session = await getSession();
  const isGuest = session.role === "guest";
  const from = monthStart();

  const [result, categoriesResult] = await Promise.all([
    db
      .prepare(
        `SELECT c.id as category_id, c.name as category_name, c.icon as category_icon,
                SUM(t.amount) as total, COUNT(*) as count
         FROM "transaction" t
         JOIN account a ON a.id = t.account_id
         LEFT JOIN category c ON c.id = t.category_id
         WHERE t.category_id != 'cat_income' AND t.category_id != 'cat_transfer'
           AND t.amount > 0 AND t.date >= ?
           AND a.is_closed = 0 AND a.is_hidden = 0
         GROUP BY t.category_id
         ORDER BY total DESC`
      )
      .bind(from)
      .all<BreakdownRow>(),
    db.prepare("SELECT id, name, icon FROM category ORDER BY name ASC").all<Category>(),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Spending</h1>
      <SpendingBreakdown
        initialBreakdown={result.results ?? []}
        categories={categoriesResult.results ?? []}
        hideLineItems={isGuest}
      />
    </div>
  );
}
