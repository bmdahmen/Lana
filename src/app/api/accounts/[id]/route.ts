import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { invalidateCache, CACHE_KEYS } from "@/lib/cache";
import { recomputeNetWorth } from "@/lib/sync";
import { isAssetClassLiability } from "@/lib/asset-classes";
import { getSpotPrices } from "@/lib/spot-price";
import { fetchZestimate } from "@/lib/zillow";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isHidden: z.boolean().optional(),
  isClosed: z.boolean().optional(),
  currentBalance: z.number().optional(),
  metalTroyOz: z.number().positive().optional(),
  relevantFrom: z.string().nullable().optional(),
  relevantUntil: z.string().nullable().optional(),
  propertyAddress: z.string().min(1).optional(),
  assetClass: z
    .enum([
      "cash",
      "brokerage",
      "retirement",
      "crypto",
      "real_estate",
      "hard_asset",
      "precious_metals",
      "liabilities",
      "other",
    ])
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (body.data.name !== undefined) {
    updates.push("name = ?");
    bindings.push(body.data.name);
  }
  if (body.data.isHidden !== undefined) {
    updates.push("is_hidden = ?");
    bindings.push(body.data.isHidden ? 1 : 0);
  }
  if (body.data.isClosed !== undefined) {
    updates.push("is_closed = ?");
    bindings.push(body.data.isClosed ? 1 : 0);
  }
  if (body.data.currentBalance !== undefined) {
    updates.push("current_balance = ?");
    bindings.push(body.data.currentBalance);
  }
  if (body.data.metalTroyOz !== undefined) {
    const account = await db
      .prepare("SELECT precious_metal FROM account WHERE id = ?")
      .bind(id)
      .first<{ precious_metal: "gold" | "silver" | null }>();
    if (!account?.precious_metal) {
      return NextResponse.json({ error: "Account is not a precious metal account" }, { status: 400 });
    }
    const prices = await getSpotPrices(db);
    updates.push("metal_troy_oz = ?", "current_balance = ?");
    bindings.push(body.data.metalTroyOz, body.data.metalTroyOz * prices[account.precious_metal]);
  }
  if (body.data.propertyAddress !== undefined) {
    const account = await db
      .prepare("SELECT asset_class FROM account WHERE id = ?")
      .bind(id)
      .first<{ asset_class: string }>();
    if (account?.asset_class !== "real_estate") {
      return NextResponse.json({ error: "Account is not a real estate account" }, { status: 400 });
    }
    let value: number;
    try {
      value = await fetchZestimate(body.data.propertyAddress);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    updates.push("property_address = ?", "current_balance = ?", "zestimate_updated_at = ?");
    bindings.push(body.data.propertyAddress, value, Date.now());
  }
  if (body.data.assetClass !== undefined) {
    updates.push("asset_class = ?", "is_asset = ?");
    bindings.push(body.data.assetClass, isAssetClassLiability(body.data.assetClass) ? 0 : 1);
  }
  if (body.data.relevantFrom !== undefined) {
    updates.push("relevant_from = ?");
    bindings.push(body.data.relevantFrom);
  }
  if (body.data.relevantUntil !== undefined) {
    updates.push("relevant_until = ?");
    bindings.push(body.data.relevantUntil);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    await db
      .prepare(`UPDATE account SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings, id)
      .run();
    await recomputeNetWorth(db, { force: true });
    await invalidateCache(CACHE_KEYS.accountsList, CACHE_KEYS.homeDashboard);
  }

  return NextResponse.json({ ok: true });
}
