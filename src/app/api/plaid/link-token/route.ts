import { NextResponse } from "next/server";
import { z } from "zod";
import { CountryCode, Products } from "plaid";
import { getPlaidClient } from "@/lib/plaid";
import { getDB } from "@/lib/db";

const requestSchema = z.object({
  // When set, creates an update-mode link token for an already-connected
  // item instead of a new-item token -- used to collect consent for the
  // Investments product on an item that was originally linked without it
  // (see lib/sync.ts's syncInvestmentTransactions).
  accountId: z.string().optional(),
});

export async function POST(request: Request) {
  const body = requestSchema.safeParse(await request.json().catch(() => ({})));
  const accountId = body.success ? body.data.accountId : undefined;

  const plaid = getPlaidClient();

  if (accountId) {
    const db = await getDB();
    const item = await db
      .prepare(
        `SELECT p.access_token FROM account a
         JOIN plaid_item p ON p.id = a.plaid_item_id
         WHERE a.id = ?`
      )
      .bind(accountId)
      .first<{ access_token: string }>();
    if (!item) {
      return NextResponse.json({ error: "Account not found or not Plaid-linked" }, { status: 404 });
    }

    const response = await plaid.linkTokenCreate({
      user: { client_user_id: "lana-single-user" },
      client_name: "Lana",
      access_token: item.access_token,
      additional_consented_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL,
    });
    return NextResponse.json({ linkToken: response.data.link_token });
  }

  const response = await plaid.linkTokenCreate({
    user: { client_user_id: "lana-single-user" },
    client_name: "Lana",
    products: [Products.Transactions],
    // Collects consent for Investments too, without restricting Link to only
    // institutions that support it -- Transactions stays the only required
    // product, so plain bank accounts can still link normally.
    additional_consented_products: [Products.Investments],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: process.env.PLAID_WEBHOOK_URL,
  });

  return NextResponse.json({ linkToken: response.data.link_token });
}
