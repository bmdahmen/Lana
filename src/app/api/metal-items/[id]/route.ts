import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { PRECIOUS_METALS } from "@/lib/asset-classes";
import { syncMetalCollectionAccounts, METAL_ITEM_CATEGORIES, type MetalItemCategory } from "@/lib/metal-items";

const CATEGORY_IDS = METAL_ITEM_CATEGORIES.map((c) => c.id) as [MetalItemCategory, ...MetalItemCategory[]];

const updateSchema = z.object({
  metal: z.enum(PRECIOUS_METALS).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  name: z.string().min(1).optional(),
  mint: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  condition: z.string().nullable().optional(),
  quantity: z.number().positive().optional(),
  troyOzEach: z.number().positive().optional(),
  faceValueEach: z.number().nonnegative().nullable().optional(),
  purchasePriceTotal: z.number().nonnegative().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const FIELD_TO_COLUMN: Record<string, string> = {
  metal: "metal",
  category: "category",
  name: "name",
  mint: "mint",
  year: "year",
  condition: "condition",
  quantity: "quantity",
  troyOzEach: "troy_oz_each",
  faceValueEach: "face_value_each",
  purchasePriceTotal: "purchase_price_total",
  purchaseDate: "purchase_date",
  notes: "notes",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const updates: string[] = [];
  const bindings: unknown[] = [];

  for (const [field, column] of Object.entries(FIELD_TO_COLUMN)) {
    const value = (body.data as Record<string, unknown>)[field];
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      bindings.push(value);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true });
  }

  updates.push("updated_at = datetime('now')");
  const result = await db
    .prepare(`UPDATE metal_item SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...bindings, id)
    .run();

  if (result.meta.changes === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await syncMetalCollectionAccounts(db);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDB();

  const result = await db.prepare("DELETE FROM metal_item WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await syncMetalCollectionAccounts(db);

  return NextResponse.json({ ok: true });
}
