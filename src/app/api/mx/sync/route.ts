import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { syncMxMember } from "@/lib/mx-sync";

export async function POST() {
  const db = await getDB();

  const user = await db
    .prepare("SELECT mx_user_guid FROM app_user WHERE id = 1")
    .first<{ mx_user_guid: string | null }>();

  if (!user?.mx_user_guid) {
    return NextResponse.json({ results: [] });
  }
  const mxUserGuid = user.mx_user_guid;

  const members = await db
    .prepare("SELECT id, mx_member_guid FROM mx_member")
    .all<{ id: string; mx_member_guid: string }>();

  const results = [];
  for (const member of members.results ?? []) {
    try {
      await syncMxMember(db, mxUserGuid, member);
      results.push({ memberId: member.id, ok: true });
    } catch (error) {
      results.push({ memberId: member.id, ok: false, error: (error as Error).message });
    }
  }

  await invalidateCache(
    CACHE_KEYS.transactionsDefault,
    CACHE_KEYS.accountsList,
    CACHE_KEYS.homeDashboard
  );

  return NextResponse.json({ results });
}
