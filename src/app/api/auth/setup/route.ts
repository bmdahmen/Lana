import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/session";

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function GET() {
  const db = await getDB();
  const existing = await db.prepare("SELECT id FROM app_user WHERE id = 1").first();
  return NextResponse.json({ needsSetup: !existing });
}

export async function POST(request: Request) {
  const db = await getDB();
  const existing = await db.prepare("SELECT id FROM app_user WHERE id = 1").first();
  if (existing) {
    return NextResponse.json({ error: "Already set up" }, { status: 409 });
  }

  const body = setupSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.data.password);
  await db
    .prepare("INSERT INTO app_user (id, email, password_hash) VALUES (1, ?, ?)")
    .bind(body.data.email, passwordHash)
    .run();

  const session = await getSession();
  session.loggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
