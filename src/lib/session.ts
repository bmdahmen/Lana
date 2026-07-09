import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Owner } from "@/lib/owners";

export interface SessionData {
  loggedIn: boolean;
  owner?: Owner;
}

function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET env var must be set to a random string of at least 32 characters"
    );
  }
  return {
    cookieName: "lana_session",
    password,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session.loggedIn === true;
}
