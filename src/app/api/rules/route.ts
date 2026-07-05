import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB, newId } from "@/lib/db";

export async function GET() {
  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT r.*, c.name as category_name, c.icon as category_icon
       FROM category_rule r
       JOIN category c ON c.id = r.category_id
       ORDER BY r.priority DESC, r.created_at ASC`
    )
    .all();
  return NextResponse.json({ rules: result.results ?? [] });
}

const createSchema = z
  .object({
    matchField: z.enum(["merchant_name", "name", "both"]),
    matchType: z.enum(["contains", "equals"]),
    matchValue: z.string().min(1),
    descriptionValue: z.string().min(1).optional(),
    categoryId: z.string().min(1),
    priority: z.number().int().optional(),
  })
  .refine((data) => data.matchField !== "both" || !!data.descriptionValue, {
    message: "descriptionValue is required when matchField is \"both\"",
    path: ["descriptionValue"],
  });

export async function POST(request: Request) {
  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const db = await getDB();
  const id = newId("rule");

  await db
    .prepare(
      `INSERT INTO category_rule (id, match_field, match_type, match_value, description_value, category_id, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.data.matchField,
      body.data.matchType,
      body.data.matchValue,
      body.data.matchField === "both" ? body.data.descriptionValue : null,
      body.data.categoryId,
      body.data.priority ?? 0
    )
    .run();

  return NextResponse.json({ ok: true, id });
}
