import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";
import { getPlaidClient } from "@/lib/plaid";
import { syncPlaidItem, findOpenDuplicateAccount, insertPlaidAccount } from "@/lib/sync";

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().nullable().optional(),
  institutionName: z.string().nullable().optional(),
  owner: z.enum(["brian", "emily"]).default("brian"),
});

export async function POST(request: Request) {
  const body = exchangeSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const plaid = getPlaidClient(body.data.owner);
  const exchangeResponse = await plaid.itemPublicTokenExchange({
    public_token: body.data.publicToken,
  });
  const { access_token: accessToken, item_id: plaidItemId } = exchangeResponse.data;

  const db = await getDB();
  const itemId = newId("item");

  await db
    .prepare(
      `INSERT INTO plaid_item (id, plaid_item_id, access_token, institution_id, institution_name, owner)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      itemId,
      plaidItemId,
      accessToken,
      body.data.institutionId ?? null,
      body.data.institutionName ?? null,
      body.data.owner
    )
    .run();

  const accountsResponse = await plaid.accountsGet({ access_token: accessToken });
  for (const acc of accountsResponse.data.accounts) {
    // Reconnecting an already-linked institution hands back fresh Plaid
    // account IDs for the same real-world accounts — without a content-based
    // check every account would be imported a second time. Skip the ones we
    // already track through another linked item.
    const dupeId = await findOpenDuplicateAccount(
      db,
      body.data.owner,
      body.data.institutionName ?? null,
      { mask: acc.mask ?? null, type: acc.type },
      itemId
    );
    if (dupeId) continue;
    await insertPlaidAccount(db, itemId, body.data.owner, {
      accountId: acc.account_id,
      name: acc.name,
      officialName: acc.official_name ?? null,
      type: acc.type,
      subtype: acc.subtype ?? null,
      mask: acc.mask ?? null,
      currentBalance: acc.balances.current ?? null,
      availableBalance: acc.balances.available ?? null,
      isoCurrencyCode: acc.balances.iso_currency_code ?? "USD",
    });
  }

  await syncPlaidItem(db, { id: itemId, access_token: accessToken, cursor: null, owner: body.data.owner });

  return NextResponse.json({ ok: true });
}
