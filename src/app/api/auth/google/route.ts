import { NextResponse } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { verifyGoogleToken } from "@/lib/google-auth";
import { getSession } from "@/lib/session";
import type { Owner } from "@/lib/owners";

const schema = z.object({ credential: z.string().min(1) });

// GOOGLE_ALLOWED_EMAIL is kept as Brian's var name for backwards compatibility
// with the secret already set in production; Emily's is a new, separate var.
const OWNER_EMAILS: Record<Owner, string | undefined> = {
  brian: process.env.GOOGLE_ALLOWED_EMAIL,
  emily: process.env.GOOGLE_ALLOWED_EMAIL_EMILY,
};

function ownerForEmail(email: string): Owner | null {
  const lower = email.toLowerCase();
  for (const owner of Object.keys(OWNER_EMAILS) as Owner[]) {
    const allowed = OWNER_EMAILS[owner];
    if (allowed && allowed.toLowerCase() === lower) return owner;
  }
  return null;
}

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

  const owner = ownerForEmail(profile.email);
  if (!owner) {
    return NextResponse.json(
      { error: "This Google account isn't authorized to sign in to Lana." },
      { status: 403 }
    );
  }

  const db = await getDB();
  const existing = await db.prepare("SELECT id FROM app_user WHERE id = ?").bind(owner).first();

  if (existing) {
    await db
      .prepare(
        "UPDATE app_user SET google_sub = ?, email = ?, name = ?, avatar = ? WHERE id = ?"
      )
      .bind(profile.sub, profile.email, profile.name, profile.picture, owner)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO app_user (id, google_sub, email, name, avatar) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(owner, profile.sub, profile.email, profile.name, profile.picture)
      .run();
  }

  const session = await getSession();
  session.loggedIn = true;
  session.owner = owner;
  await session.save();

  return NextResponse.json({ ok: true });
}
