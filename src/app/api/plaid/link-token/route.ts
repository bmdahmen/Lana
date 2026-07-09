import { NextResponse } from "next/server";
import { z } from "zod";
import { CountryCode, Products } from "plaid";
import { getPlaidClient } from "@/lib/plaid";
import { getDB } from "@/lib/db";
import type { Owner } from "@/lib/owners";

const requestSchema = z.object({
  // When set, creates an update-mode link token for an already-connected
  // item instead of a new-item token -- used to collect consent for the
  // Investments product on an item that was originally linked without it
  // (see lib/sync.ts's syncInvestmentTransactions). The item's owner (and
  // thus which Plaid credentials to use) is looked up from the DB in this
  // case, not taken from the request.
  accountId: z.string().optional(),
  // Which household member's Plaid credentials to link a *new* item with.
  // Ignored when accountId is set.
  owner: z.enum(["brian", "emily"]).optional(),
});

export async function POST(request: Request) {
  const body = requestSchema.safeParse(await request.json().catch(() => ({})));
  const accountId = body.success ? body.data.accountId : undefined;

  if (accountId) {
    const db = await getDB();
    const item = await db
      .prepare(
        `SELECT p.access_token, p.owner FROM account a
         JOIN plaid_item p ON p.id = a.plaid_item_id
         WHERE a.id = ?`
      )
      .bind(accountId)
      .first<{ access_token: string; owner: Owner }>();
    if (!item) {
      return NextResponse.json({ error: "Account not found or not Plaid-linked" }, { status: 404 });
    }

    const plaid = getPlaidClient(item.owner);
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: `lana-${item.owner}` },
      client_name: "Lana",
      access_token: item.access_token,
      additional_consented_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL,
    });
    return NextResponse.json({ linkToken: response.data.link_token });
  }

  const owner: Owner = body.success && body.data.owner ? body.data.owner : "brian";
  const plaid = getPlaidClient(owner);
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: `lana-${owner}` },
    client_name: "Lana",
    products: [Products.Transactions],
    // Collects consent for Investments too, without restricting Link to only
    // institutions that support it -- Transactions stays the only required
    // product, so plain bank accounts can still link normally.
    additional_consented_products: [Products.Investments],
    // Without this, Plaid only backfills ~90 days of transaction history on
    // initial Link. 730 is the max Plaid allows; actual depth still depends
    // on what the institution itself retains.
    transactions: { days_requested: 730 },
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: process.env.PLAID_WEBHOOK_URL,
  });

  return NextResponse.json({ linkToken: response.data.link_token });
}
