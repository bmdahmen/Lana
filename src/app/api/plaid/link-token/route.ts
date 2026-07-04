import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getPlaidClient } from "@/lib/plaid";

export async function POST() {
  const plaid = getPlaidClient();

  const response = await plaid.linkTokenCreate({
    user: { client_user_id: "lana-single-user" },
    client_name: "Lana",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: process.env.PLAID_WEBHOOK_URL,
  });

  return NextResponse.json({ linkToken: response.data.link_token });
}
