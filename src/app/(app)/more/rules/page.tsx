import { getDB } from "@/lib/db";
import { RulesTable } from "@/components/rules-table";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Rule {
  id: string;
  match_field: "merchant_name" | "name" | "both";
  match_type: "contains" | "equals";
  match_value: string;
  description_value: string | null;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  priority: number;
}

export default async function RulesPage() {
  const db = await getDB();
  const [categoriesResult, rulesResult] = await Promise.all([
    db.prepare("SELECT id, name, icon FROM category ORDER BY name ASC").all<Category>(),
    db
      .prepare(
        `SELECT r.*, c.name as category_name, c.icon as category_icon
         FROM category_rule r
         JOIN category c ON c.id = r.category_id
         ORDER BY r.priority DESC, r.created_at ASC`
      )
      .all<Rule>(),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Rules</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Automatically categorize transactions by matching their description, merchant name, or
          both. Rules run on every new transaction, and can also be applied to existing ones.
        </p>
      </div>
      <RulesTable categories={categoriesResult.results ?? []} initialRules={rulesResult.results ?? []} />
    </div>
  );
}
