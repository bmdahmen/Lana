import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";
import { recomputeNetWorth } from "@/lib/sync";
import { isAssetClassLiability } from "@/lib/asset-classes";

export async function GET() {
  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT a.*, p.institution_name, p.status as item_status
       FROM account a
       LEFT JOIN plaid_item p ON p.id = a.plaid_item_id
       WHERE a.is_closed = 0
       ORDER BY a.is_hidden ASC, a.type ASC, a.name ASC`
    )
    .all();

  return NextResponse.json({ accounts: result.results ?? [] });
}

const createSchema = z.object({
  name: z.string().min(1),
  assetClass: z.enum([
    "cash",
    "brokerage",
    "retirement",
    "crypto",
    "real_estate",
    "hard_asset",
    "liabilities",
    "other",
  ]),
  currentBalance: z.number(),
});

export async function POST(request: Request) {
  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const id = newId("acct");
  const isAsset = !isAssetClassLiability(body.data.assetClass);

  await db
    .prepare(
      `INSERT INTO account (id, name, type, current_balance, is_manual, is_asset, asset_class)
       VALUES (?, ?, 'other', ?, 1, ?, ?)`
    )
    .bind(id, body.data.name, body.data.currentBalance, isAsset ? 1 : 0, body.data.assetClass)
    .run();

  await recomputeNetWorth(db);

  return NextResponse.json({ ok: true, id });
}
