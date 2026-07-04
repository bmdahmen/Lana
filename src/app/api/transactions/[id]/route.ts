import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";

const updateSchema = z.object({
  categoryId: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = await getDB();

  if (body.data.categoryId !== undefined) {
    await db
      .prepare(
        `UPDATE "transaction" SET category_id = ?, category_source = 'manual', updated_at = datetime('now') WHERE id = ?`
      )
      .bind(body.data.categoryId, id)
      .run();
  }

  if (body.data.notes !== undefined) {
    await db
      .prepare(`UPDATE "transaction" SET notes = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(body.data.notes, id)
      .run();
  }

  return NextResponse.json({ ok: true });
}
