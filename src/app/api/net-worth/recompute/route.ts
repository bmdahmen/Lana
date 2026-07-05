import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { recomputeAccountBalances } from "@/lib/sync";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";

export async function POST() {
  const db = await getDB();
  await recomputeAccountBalances(db, { force: true });
  await invalidateCache(
    CACHE_KEYS.transactionsDefault,
    CACHE_KEYS.accountsList,
    CACHE_KEYS.homeDashboard
  );
  return NextResponse.json({ ok: true });
}
