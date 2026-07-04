import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { recomputeNetWorth } from "@/lib/sync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Number(searchParams.get("days") ?? 90), 3650);

  const db = await getDB();
  await recomputeNetWorth(db);

  const result = await db
    .prepare(
      `SELECT date, total_assets, total_liabilities, net_worth
       FROM net_worth_snapshot
       ORDER BY date DESC
       LIMIT ?`
    )
    .bind(days)
    .all();

  const snapshots = (result.results ?? []).reverse();
  return NextResponse.json({ snapshots });
}
