import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getInvestmentBreakdown } from "@/lib/investment-transactions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const assetClassParam = searchParams.get("assetClass");
  const assetClasses = assetClassParam ? assetClassParam.split(",").filter(Boolean) : undefined;

  const db = await getDB();
  const breakdown = await getInvestmentBreakdown(db, { from, to, assetClasses });

  return NextResponse.json({ breakdown });
}
