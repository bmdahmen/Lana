import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { verifyGoogleToken } from "@/lib/google-auth";
import { getSession } from "@/lib/session";

const schema = z.object({ credential: z.string().min(1) });

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let profile;
  try {
    profile = await verifyGoogleToken(body.data.credential);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const allowedEmail = process.env.GOOGLE_ALLOWED_EMAIL;
  if (allowedEmail && profile.email.toLowerCase() !== allowedEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "This app is restricted to a single Google account." },
      { status: 403 }
    );
  }

  const db = await getDB();
  const existing = await db.prepare("SELECT id FROM app_user WHERE id = 1").first();

  if (existing) {
    await db
      .prepare(
        "UPDATE app_user SET google_sub = ?, email = ?, name = ?, avatar = ? WHERE id = 1"
      )
      .bind(profile.sub, profile.email, profile.name, profile.picture)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO app_user (id, google_sub, email, name, avatar) VALUES (1, ?, ?, ?, ?)"
      )
      .bind(profile.sub, profile.email, profile.name, profile.picture)
      .run();
  }

  const session = await getSession();
  session.loggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
