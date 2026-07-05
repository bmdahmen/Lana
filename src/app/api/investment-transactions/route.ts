import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { listInvestmentTransactions } from "@/lib/investment-transactions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const accountId = searchParams.get("accountId") ?? undefined;
  const assetClassParam = searchParams.get("assetClass");
  const assetClasses = assetClassParam ? assetClassParam.split(",").filter(Boolean) : undefined;
  const sort = searchParams.get("sort") === "amount" ? "amount" : "recent";
  const limit = Number(searchParams.get("limit") ?? 100);
  const offset = Number(searchParams.get("offset") ?? 0);

  const db = await getDB();
  const transactions = await listInvestmentTransactions(db, {
    from,
    to,
    accountId,
    assetClasses,
    sort,
    limit,
    offset,
  });

  return NextResponse.json({ transactions });
}
