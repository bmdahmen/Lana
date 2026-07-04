import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";
import { getMember, listMemberAccounts } from "@/lib/mx";
import { deriveMxAssetClass, isAssetClassLiability } from "@/lib/asset-classes";
import { syncMxMember } from "@/lib/mx-sync";

const schema = z.object({ memberGuid: z.string().min(1) });

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = await getDB();
  const user = await db
    .prepare("SELECT mx_user_guid FROM app_user WHERE id = 1")
    .first<{ mx_user_guid: string | null }>();

  if (!user?.mx_user_guid) {
    return NextResponse.json({ error: "MX user not initialized" }, { status: 400 });
  }
  const mxUserGuid = user.mx_user_guid;

  const mxMember = await getMember(mxUserGuid, body.data.memberGuid);

  const memberRow = await db
    .prepare("SELECT id FROM mx_member WHERE mx_member_guid = ?")
    .bind(mxMember.guid)
    .first<{ id: string }>();

  let memberId: string;
  if (memberRow) {
    memberId = memberRow.id;
    await db
      .prepare(
        "UPDATE mx_member SET institution_code = ?, institution_name = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(mxMember.institution_code, mxMember.name, memberId)
      .run();
  } else {
    memberId = newId("mxmem");
    await db
      .prepare(
        "INSERT INTO mx_member (id, mx_member_guid, institution_code, institution_name) VALUES (?, ?, ?, ?)"
      )
      .bind(memberId, mxMember.guid, mxMember.institution_code, mxMember.name)
      .run();
  }

  const accounts = await listMemberAccounts(mxUserGuid, mxMember.guid);
  for (const acc of accounts) {
    const existing = await db
      .prepare("SELECT id FROM account WHERE mx_account_guid = ?")
      .bind(acc.guid)
      .first<{ id: string }>();
    if (existing) continue;

    const assetClass = deriveMxAssetClass(acc.type, acc.subtype);
    await db
      .prepare(
        `INSERT INTO account (
           id, mx_member_id, mx_account_guid, name, type, subtype,
           current_balance, available_balance, iso_currency_code, is_asset, asset_class
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId("acct"),
        memberId,
        acc.guid,
        acc.name,
        acc.type,
        acc.subtype,
        acc.balance,
        acc.available_balance,
        acc.currency_code ?? "USD",
        isAssetClassLiability(assetClass) ? 0 : 1,
        assetClass
      )
      .run();
  }

  await syncMxMember(db, mxUserGuid, { id: memberId, mx_member_guid: mxMember.guid });

  return NextResponse.json({ ok: true });
}
