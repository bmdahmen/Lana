import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic endpoint -- returns the raw RapidAPI response for the
 * two calls fetchZestimate makes, so we can see the exact status/body
 * without needing account access to the RapidAPI dashboard. Remove once the
 * Zillow integration is confirmed working.
 */
export async function GET(request: Request) {
  const address =
    new URL(request.url).searchParams.get("address") ?? "18321 SE 147th Pl, Renton, WA 98059";
  const host = process.env.ZILLOW_RAPIDAPI_HOST || "zillow-com1.p.rapidapi.com";
  const key = process.env.ZILLOW_RAPIDAPI_KEY;

  if (!key) {
    return NextResponse.json({ error: "ZILLOW_RAPIDAPI_KEY is not set" }, { status: 500 });
  }

  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": host };

  const searchUrl = `https://${host}/propertyExtendedSearch?location=${encodeURIComponent(address)}`;
  const searchRes = await fetch(searchUrl, { headers });
  const searchBody = await searchRes.text();

  let zpid: unknown;
  try {
    zpid = (JSON.parse(searchBody) as { props?: Array<{ zpid?: unknown }> }).props?.[0]?.zpid;
  } catch {
    // not JSON or unexpected shape -- leave zpid undefined
  }

  let propertyResult: { url: string; status: number; body: string } | null = null;
  if (zpid != null) {
    const propertyUrl = `https://${host}/property?zpid=${zpid}`;
    const propertyRes = await fetch(propertyUrl, { headers });
    propertyResult = {
      url: propertyUrl,
      status: propertyRes.status,
      body: (await propertyRes.text()).slice(0, 3000),
    };
  }

  return NextResponse.json({
    host,
    search: { url: searchUrl, status: searchRes.status, body: searchBody.slice(0, 3000) },
    resolvedZpid: zpid ?? null,
    property: propertyResult,
  });
}
