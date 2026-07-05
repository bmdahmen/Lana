const ZESTIMATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getZillowHost(): string {
  return process.env.ZILLOW_RAPIDAPI_HOST || "zillow-real-estate-api.p.rapidapi.com";
}

function getZillowApiKey(): string {
  const key = process.env.ZILLOW_RAPIDAPI_KEY;
  if (!key) throw new Error("ZILLOW_RAPIDAPI_KEY must be set");
  return key;
}

const RATE_LIMIT_RETRY_DELAYS_MS = [500, 1500];

/** RapidAPI free/basic tiers commonly cap requests per second; retry a 429 a couple times before giving up. */
async function zillowFetch(url: string, host: string): Promise<Response> {
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      headers: { "x-rapidapi-key": getZillowApiKey(), "x-rapidapi-host": host },
    });
    if (res.status !== 429 || attempt >= RATE_LIMIT_RETRY_DELAYS_MS.length) return res;
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAYS_MS[attempt]));
  }
}

interface PropertyLookupData {
  zpid: number;
  address?: { full?: string };
  financials?: { zestimate?: number };
}

interface PropertyLookupResponse {
  success: boolean;
  data?: PropertyLookupData;
  error?: { code: string; message: string };
}

/** Resolves a free-text address to full property details, including the Zestimate, in one call. */
async function lookupProperty(rawAddress: string): Promise<PropertyLookupData> {
  const address = rawAddress.replace(/\s*\n+\s*/g, ", ").trim();
  const host = getZillowHost();
  const res = await zillowFetch(
    `https://${host}/v1/property/lookup?address=${encodeURIComponent(address)}`,
    host
  );
  const json = (await res.json().catch(() => null)) as PropertyLookupResponse | null;

  if (!res.ok || !json?.success || !json.data) {
    const detail =
      json?.error?.message ?? (res.status === 429 ? "rate limited by the Zillow API" : `HTTP ${res.status}`);
    throw new Error(`Zillow lookup failed for "${address}": ${detail}`);
  }

  return json.data;
}

export interface AddressSuggestion {
  address: string;
  zpid: string;
}

/** A live suggestion for a partial/typo'd address, for an autocomplete dropdown. */
export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  try {
    const data = await lookupProperty(query);
    if (!data.address?.full) return [];
    return [{ address: data.address.full, zpid: String(data.zpid) }];
  } catch {
    return [];
  }
}

/** Looks up a live Zestimate for an address via a RapidAPI Zillow data provider. */
export async function fetchZestimate(address: string): Promise<number> {
  const data = await lookupProperty(address);
  if (typeof data.financials?.zestimate !== "number") {
    throw new Error(`No Zestimate found for "${address}"`);
  }
  return data.financials.zestimate;
}

/** Refreshes any real-estate account's cached Zestimate once it's more than a day old. */
export async function recomputeRealEstateAccountBalances(db: D1Database): Promise<void> {
  const now = Date.now();
  const stale = await db
    .prepare(
      `SELECT id, property_address FROM account
       WHERE asset_class = 'real_estate' AND property_address IS NOT NULL AND is_closed = 0
         AND (zestimate_updated_at IS NULL OR ? - zestimate_updated_at > ?)`
    )
    .bind(now, ZESTIMATE_MAX_AGE_MS)
    .all<{ id: string; property_address: string }>();

  for (const account of stale.results ?? []) {
    try {
      const value = await fetchZestimate(account.property_address);
      await db
        .prepare(
          `UPDATE account SET current_balance = ?, zestimate_updated_at = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(value, now, account.id)
        .run();
    } catch (error) {
      console.error(`Failed to refresh Zestimate for account ${account.id}`, (error as Error).message);
    }
  }
}
