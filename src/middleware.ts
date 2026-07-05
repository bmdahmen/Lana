import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsealData } from "iron-session";

const PUBLIC_PATHS = ["/login", "/api/auth/google"];

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get("lana_session")?.value;
  if (!cookie) return false;
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) return false;
  try {
    const data = await unsealData<{ loggedIn?: boolean }>(cookie, { password });
    return data.loggedIn === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/plaid/webhook") ||
    // Guarded by its own CRON_SECRET check (see route.ts), not session auth --
    // the Worker's scheduled() handler calls it with no user session.
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  const loggedIn = await hasValidSession(request);

  if (!loggedIn && !pathname.startsWith("/login")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // PWA/home-screen assets (icons, manifest) are fetched unauthenticated by
  // the OS/browser, same reasoning as the favicon.ico exclusion below.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.svg|icon-192.png|icon-512.png|manifest.webmanifest).*)",
  ],
};
