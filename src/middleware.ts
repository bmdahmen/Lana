import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsealData } from "iron-session";

const PUBLIC_PATHS = ["/login", "/api/auth/google", "/api/auth/guest"];
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function readSession(
  request: NextRequest
): Promise<{ loggedIn: boolean; role?: "owner" | "guest" }> {
  const cookie = request.cookies.get("lana_session")?.value;
  if (!cookie) return { loggedIn: false };
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) return { loggedIn: false };
  try {
    const data = await unsealData<{ loggedIn?: boolean; role?: "owner" | "guest" }>(cookie, {
      password,
    });
    return { loggedIn: data.loggedIn === true, role: data.role };
  } catch {
    return { loggedIn: false };
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

  const { loggedIn, role } = await readSession(request);

  if (!loggedIn && !pathname.startsWith("/login")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Guest (passcode) sessions can browse and read everything but never
  // mutate anything -- audit-only access. Auth endpoints (logout) stay
  // reachable regardless of method so a guest can still sign out.
  if (
    loggedIn &&
    role === "guest" &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !READ_ONLY_METHODS.has(request.method)
  ) {
    return NextResponse.json({ error: "Guest access is read-only." }, { status: 403 });
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
