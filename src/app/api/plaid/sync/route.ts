import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { syncPlaidItem } from "@/lib/sync";
import type { Owner } from "@/lib/owners";

export async function POST() {
  const db = await getDB();
  const items = await db
    .prepare("SELECT id, access_token, cursor, owner FROM plaid_item WHERE status = 'good'")
    .all<{ id: string; access_token: string; cursor: string | null; owner: Owner }>();

  const results = [];
  for (const item of items.results ?? []) {
    try {
      await syncPlaidItem(db, item);
      results.push({ itemId: item.id, ok: true });
    } catch (error) {
      results.push({ itemId: item.id, ok: false, error: (error as Error).message });
    }
  }

  await invalidateCache(
    CACHE_KEYS.transactionsDefault,
    CACHE_KEYS.accountsList,
    CACHE_KEYS.homeDashboard
  );

  return NextResponse.json({ results });
}
