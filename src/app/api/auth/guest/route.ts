import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";

const schema = z.object({ passcode: z.string().min(1) });

/** Read-only "audit" access via a shared passcode instead of Google sign-in
 *  -- see middleware.ts, which blocks every non-GET request for a guest
 *  session regardless of which route it hits. */
export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const guestPasscode = process.env.GUEST_PASSCODE ?? "audit";
  if (body.data.passcode.trim() !== guestPasscode) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const session = await getSession();
  session.loggedIn = true;
  session.role = "guest";
  await session.save();

  return NextResponse.json({ ok: true });
}
