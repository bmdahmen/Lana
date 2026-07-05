import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { syncPlaidItem } from "@/lib/sync";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { webhook_type: webhookType, webhook_code: webhookCode, item_id: plaidItemId } = payload as {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
  };

  const db = await getDB();

  if (webhookType === "TRANSACTIONS" && webhookCode === "SYNC_UPDATES_AVAILABLE" && plaidItemId) {
    const item = await db
      .prepare("SELECT id, access_token, cursor FROM plaid_item WHERE plaid_item_id = ?")
      .bind(plaidItemId)
      .first<{ id: string; access_token: string; cursor: string | null }>();
    if (item) {
      await syncPlaidItem(db, item);
      await invalidateCache(
        CACHE_KEYS.transactionsDefault,
        CACHE_KEYS.accountsList,
        CACHE_KEYS.homeDashboard
      );
    }
  }

  if (webhookType === "ITEM" && webhookCode === "ERROR" && plaidItemId) {
    await db
      .prepare("UPDATE plaid_item SET status = 'error', updated_at = datetime('now') WHERE plaid_item_id = ?")
      .bind(plaidItemId)
      .run();
  }

  if (webhookType === "ITEM" && webhookCode === "LOGIN_REPAIRED" && plaidItemId) {
    await db
      .prepare("UPDATE plaid_item SET status = 'good', updated_at = datetime('now') WHERE plaid_item_id = ?")
      .bind(plaidItemId)
      .run();
  }

  return NextResponse.json({ ok: true });
}
