import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";
import { getCached, invalidateCache, CACHE_KEYS } from "@/lib/cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
  const offset = Number(searchParams.get("offset") ?? 0);

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (accountId) {
    conditions.push("t.account_id = ?");
    bindings.push(accountId);
  }
  if (categoryId) {
    conditions.push("t.category_id = ?");
    bindings.push(categoryId);
  }
  if (search) {
    conditions.push("(t.name LIKE ? OR t.merchant_name LIKE ?)");
    bindings.push(`%${search}%`, `%${search}%`);
  }
  if (from) {
    conditions.push("t.date >= ?");
    bindings.push(from);
  }
  if (to) {
    conditions.push("t.date <= ?");
    bindings.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDB();
  const runQuery = async () => {
    const result = await db
      .prepare(
        `SELECT t.*, a.name as account_name, c.name as category_name, c.icon as category_icon
         FROM "transaction" t
         JOIN account a ON a.id = t.account_id
         LEFT JOIN category c ON c.id = t.category_id
         ${where}
         ORDER BY t.date DESC, t.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...bindings, limit, offset)
      .all();
    return result.results ?? [];
  };

  // Only the plain, unfiltered first page is worth caching -- it's what every
  // tab switch to Transactions loads, whereas filtered/paged queries are each
  // hit once and would just bloat the cache.
  const isDefaultQuery = conditions.length === 0 && limit === 100 && offset === 0;
  const transactions = isDefaultQuery
    ? await getCached(CACHE_KEYS.transactionsDefault, runQuery)
    : await runQuery();

  return NextResponse.json({ transactions });
}

const createSchema = z.object({
  accountId: z.string(),
  amount: z.number(),
  date: z.string(),
  name: z.string().min(1),
  categoryId: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const id = newId("txn");

  await db
    .prepare(
      `INSERT INTO "transaction" (
         id, account_id, amount, date, name, category_id, notes, is_manual, category_source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'manual')`
    )
    .bind(
      id,
      body.data.accountId,
      body.data.amount,
      body.data.date,
      body.data.name,
      body.data.categoryId ?? "cat_other",
      body.data.notes ?? null
    )
    .run();

  await invalidateCache(CACHE_KEYS.transactionsDefault, CACHE_KEYS.homeDashboard);

  return NextResponse.json({ ok: true, id });
}
