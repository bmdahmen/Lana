import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { applyEraAccounts, applyEraTransactions } from "@/lib/era-sync";
import { recomputeNetWorth } from "@/lib/sync";

const balanceSchema = z.object({
  current: z.number().optional(),
  available: z.number().optional(),
  currency: z.string(),
});

const accountSchema = z.object({
  account_group_key: z.string(),
  name: z.string(),
  institution: z.string(),
  type: z.string(),
  balance: balanceSchema,
  visibility: z.string().optional(),
});

const transactionSchema = z.object({
  transaction_id: z.string(),
  account_group_key: z.string(),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  merchant_name: z.string().optional(),
  transaction_date: z.string(),
  posted_date: z.string(),
  is_pending: z.boolean(),
  category: z.string().optional(),
  is_cash_outflow: z.boolean(),
});

const bodySchema = z.object({
  accounts: z.array(accountSchema),
  transactions: z.array(transactionSchema),
});

export async function POST(request: Request) {
  const secret = process.env.ERA_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ERA_SYNC_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const accountResult = await applyEraAccounts(db, body.data.accounts);
  const transactionResult = await applyEraTransactions(db, body.data.transactions);
  await recomputeNetWorth(db);

  return NextResponse.json({ ok: true, ...accountResult, ...transactionResult });
}
