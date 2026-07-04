import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { recomputeNetWorth } from "@/lib/sync";
import { getNetWorthByClass } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Number(searchParams.get("days") ?? 90), 3650);

  const db = await getDB();
  await recomputeNetWorth(db);
  const points = await getNetWorthByClass(db, days);

  return NextResponse.json({ points });
}
