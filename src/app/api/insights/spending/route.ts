import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [
    "t.category_id != 'cat_income'",
    "t.category_id != 'cat_transfer'",
    "t.amount > 0",
    "a.is_closed = 0",
    "a.is_hidden = 0",
  ];
  const bindings: unknown[] = [];

  if (from) {
    conditions.push("t.date >= ?");
    bindings.push(from);
  }
  if (to) {
    conditions.push("t.date <= ?");
    bindings.push(to);
  }

  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT c.id as category_id, c.name as category_name, c.icon as category_icon,
              SUM(t.amount) as total, COUNT(*) as count
       FROM "transaction" t
       JOIN account a ON a.id = t.account_id
       LEFT JOIN category c ON c.id = t.category_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY t.category_id
       ORDER BY total DESC`
    )
    .bind(...bindings)
    .all();

  return NextResponse.json({ breakdown: result.results ?? [] });
}
