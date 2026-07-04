import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";

const updateSchema = z.object({
  matchField: z.enum(["merchant_name", "name"]).optional(),
  matchType: z.enum(["contains", "equals"]).optional(),
  matchValue: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  priority: z.number().int().optional(),
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

  const fields: Record<string, unknown> = {
    match_field: body.data.matchField,
    match_type: body.data.matchType,
    match_value: body.data.matchValue,
    category_id: body.data.categoryId,
    priority: body.data.priority,
  };
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const db = await getDB();
  await db
    .prepare(
      `UPDATE category_rule SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`
    )
    .bind(...entries.map(([, value]) => value), id)
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  await db.prepare("DELETE FROM category_rule WHERE id = ?").bind(id).run();
  return NextResponse.json({ ok: true });
}
