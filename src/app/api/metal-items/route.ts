import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";
import { PRECIOUS_METALS } from "@/lib/asset-classes";
import {
  getMetalItems,
  syncMetalCollectionAccounts,
  METAL_ITEM_CATEGORIES,
  type MetalItemCategory,
} from "@/lib/metal-items";

const CATEGORY_IDS = METAL_ITEM_CATEGORIES.map((c) => c.id) as [MetalItemCategory, ...MetalItemCategory[]];

export async function GET(request: Request) {
  const db = await getDB();
  const { searchParams } = new URL(request.url);
  const metal = searchParams.get("metal");
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const items = await getMetalItems(db, {
    metal: metal === "gold" || metal === "silver" ? metal : undefined,
    category: category && CATEGORY_IDS.includes(category as MetalItemCategory) ? (category as MetalItemCategory) : undefined,
    q: q ?? undefined,
  });

  return NextResponse.json({ items });
}

const createSchema = z.object({
  metal: z.enum(PRECIOUS_METALS),
  category: z.enum(CATEGORY_IDS),
  name: z.string().min(1),
  mint: z.string().min(1).optional(),
  year: z.number().int().optional(),
  condition: z.string().min(1).optional(),
  quantity: z.number().positive(),
  troyOzEach: z.number().positive(),
  faceValueEach: z.number().nonnegative().optional(),
  purchasePriceTotal: z.number().nonnegative().optional(),
  purchaseDate: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const id = newId("mitem");

  await db
    .prepare(
      `INSERT INTO metal_item (
         id, metal, category, name, mint, year, condition, quantity, troy_oz_each,
         face_value_each, purchase_price_total, purchase_date, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.data.metal,
      body.data.category,
      body.data.name,
      body.data.mint ?? null,
      body.data.year ?? null,
      body.data.condition ?? null,
      body.data.quantity,
      body.data.troyOzEach,
      body.data.faceValueEach ?? null,
      body.data.purchasePriceTotal ?? null,
      body.data.purchaseDate ?? null,
      body.data.notes ?? null
    )
    .run();

  await syncMetalCollectionAccounts(db);

  return NextResponse.json({ ok: true, id });
}
