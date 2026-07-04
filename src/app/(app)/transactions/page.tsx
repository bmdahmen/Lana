import { getDB } from "@/lib/db";
import { TransactionsTable } from "@/components/transactions-table";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export default async function TransactionsPage() {
  const db = await getDB();
  const categoriesResult = await db
    .prepare("SELECT id, name, icon FROM category ORDER BY name ASC")
    .all<Category>();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Transactions</h1>
      <TransactionsTable categories={categoriesResult.results ?? []} />
    </div>
  );
}
