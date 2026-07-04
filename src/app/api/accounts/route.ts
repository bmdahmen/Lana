import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";
import { recomputeNetWorth } from "@/lib/sync";
import { isAssetClassLiability, PRECIOUS_METALS } from "@/lib/asset-classes";
import { getSpotPrices } from "@/lib/spot-price";
import { fetchZestimate } from "@/lib/zillow";

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

const createSchema = z
  .object({
    name: z.string().min(1),
    assetClass: z.enum([
      "cash",
      "brokerage",
      "retirement",
      "crypto",
      "real_estate",
      "hard_asset",
      "precious_metals",
      "liabilities",
      "other",
    ]),
    currentBalance: z.number().optional(),
    preciousMetal: z.enum(PRECIOUS_METALS).optional(),
    metalTroyOz: z.number().positive().optional(),
    propertyAddress: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.assetClass === "precious_metals") {
        return data.preciousMetal !== undefined && data.metalTroyOz !== undefined;
      }
      if (data.assetClass === "real_estate") {
        return data.propertyAddress !== undefined;
      }
      return data.currentBalance !== undefined;
    },
    { message: "Missing required fields for this account type" }
  );

export async function POST(request: Request) {
  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const id = newId("acct");
  const isAsset = !isAssetClassLiability(body.data.assetClass);

  let currentBalance = body.data.currentBalance ?? 0;
  let zestimateUpdatedAt: number | null = null;
  if (body.data.assetClass === "precious_metals" && body.data.preciousMetal && body.data.metalTroyOz) {
    const prices = await getSpotPrices(db);
    currentBalance = body.data.metalTroyOz * prices[body.data.preciousMetal];
  }
  if (body.data.assetClass === "real_estate" && body.data.propertyAddress) {
    try {
      currentBalance = await fetchZestimate(body.data.propertyAddress);
      zestimateUpdatedAt = Date.now();
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
  }

  await db
    .prepare(
      `INSERT INTO account (
         id, name, type, current_balance, is_manual, is_asset, asset_class,
         precious_metal, metal_troy_oz, property_address, zestimate_updated_at
       ) VALUES (?, ?, 'other', ?, 1, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.data.name,
      currentBalance,
      isAsset ? 1 : 0,
      body.data.assetClass,
      body.data.preciousMetal ?? null,
      body.data.metalTroyOz ?? null,
      body.data.propertyAddress ?? null,
      zestimateUpdatedAt
    )
    .run();

  await recomputeNetWorth(db, { force: true });

  return NextResponse.json({ ok: true, id });
}
