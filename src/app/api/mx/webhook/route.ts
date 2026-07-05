import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { syncMxMember } from "@/lib/mx-sync";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { type, action, member_guid: memberGuid } = payload as {
    type?: string;
    action?: string;
    member_guid?: string;
  };

  if (type === "AGGREGATION" && action === "member_data_updated" && memberGuid) {
    const db = await getDB();
    const user = await db
      .prepare("SELECT mx_user_guid FROM app_user WHERE id = 1")
      .first<{ mx_user_guid: string | null }>();
    const member = await db
      .prepare("SELECT id, mx_member_guid FROM mx_member WHERE mx_member_guid = ?")
      .bind(memberGuid)
      .first<{ id: string; mx_member_guid: string }>();

    if (user?.mx_user_guid && member) {
      await syncMxMember(db, user.mx_user_guid, member);
      await invalidateCache(
        CACHE_KEYS.transactionsDefault,
        CACHE_KEYS.accountsList,
        CACHE_KEYS.homeDashboard
      );
    }
  }

  return NextResponse.json({ ok: true });
}
