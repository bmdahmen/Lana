import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

const INVESTMENT_ASSET_CLASSES = ["brokerage", "retirement", "crypto"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const assetClassParam = searchParams.get("assetClass");
  const assetClasses = assetClassParam
    ? assetClassParam.split(",").filter((c) => INVESTMENT_ASSET_CLASSES.includes(c))
    : INVESTMENT_ASSET_CLASSES;
  const classes = assetClasses.length > 0 ? assetClasses : INVESTMENT_ASSET_CLASSES;

  const conditions = [`a.asset_class IN (${classes.map(() => "?").join(", ")})`, "a.is_closed = 0", "a.is_hidden = 0"];
  const bindings: unknown[] = [...classes];

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
      `SELECT a.id as account_id, a.name as account_name, a.asset_class,
              SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END) as contributions,
              SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as distributions,
              COUNT(*) as count
       FROM "transaction" t
       JOIN account a ON a.id = t.account_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY a.id
       HAVING contributions > 0 OR distributions > 0
       ORDER BY contributions DESC`
    )
    .bind(...bindings)
    .all();

  return NextResponse.json({ breakdown: result.results ?? [] });
}
