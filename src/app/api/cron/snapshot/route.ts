import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { recomputeAccountBalances } from "@/lib/sync";

/**
 * Hit by the Worker's own `scheduled()` handler (see worker-entry.ts) once a
 * day, so a balance snapshot gets written even if nobody opens the app --
 * unlike the page-load recompute, this always forces a run.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDB();
  await recomputeAccountBalances(db, { force: true });
  await invalidateCache(CACHE_KEYS.homeDashboard, CACHE_KEYS.transactionsDefault, CACHE_KEYS.accountsList);
  return NextResponse.json({ ok: true });
}
