import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";
import { getPlaidClient } from "@/lib/plaid";
import { syncPlaidItem, accountIsAsset } from "@/lib/sync";
import { derivePlaidAssetClass } from "@/lib/asset-classes";

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().nullable().optional(),
  institutionName: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const body = exchangeSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const plaid = getPlaidClient();
  const exchangeResponse = await plaid.itemPublicTokenExchange({
    public_token: body.data.publicToken,
  });
  const { access_token: accessToken, item_id: plaidItemId } = exchangeResponse.data;

  const db = await getDB();
  const itemId = newId("item");

  await db
    .prepare(
      `INSERT INTO plaid_item (id, plaid_item_id, access_token, institution_id, institution_name)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(itemId, plaidItemId, accessToken, body.data.institutionId ?? null, body.data.institutionName ?? null)
    .run();

  const accountsResponse = await plaid.accountsGet({ access_token: accessToken });
  for (const acc of accountsResponse.data.accounts) {
    await db
      .prepare(
        `INSERT INTO account (
           id, plaid_item_id, plaid_account_id, name, official_name, type, subtype, mask,
           current_balance, available_balance, iso_currency_code, is_asset, asset_class
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId("acct"),
        itemId,
        acc.account_id,
        acc.name,
        acc.official_name ?? null,
        acc.type,
        acc.subtype ?? null,
        acc.mask ?? null,
        acc.balances.current ?? null,
        acc.balances.available ?? null,
        acc.balances.iso_currency_code ?? "USD",
        accountIsAsset(acc.type) ? 1 : 0,
        derivePlaidAssetClass(acc.type, acc.subtype ?? null)
      )
      .run();
  }

  await syncPlaidItem(db, { id: itemId, access_token: accessToken, cursor: null });

  return NextResponse.json({ ok: true });
}
