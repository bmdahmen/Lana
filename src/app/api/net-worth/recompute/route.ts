import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { recomputeAccountBalances } from "@/lib/sync";

export async function POST() {
  const db = await getDB();
  await recomputeAccountBalances(db, { force: true });
  return NextResponse.json({ ok: true });
}
