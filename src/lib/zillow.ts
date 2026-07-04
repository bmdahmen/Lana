const ZESTIMATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getZillowHost(): string {
  return process.env.ZILLOW_RAPIDAPI_HOST || "zillow-com1.p.rapidapi.com";
}

function getZillowApiKey(): string {
  const key = process.env.ZILLOW_RAPIDAPI_KEY;
  if (!key) throw new Error("ZILLOW_RAPIDAPI_KEY must be set");
  return key;
}

function zillowHeaders(host: string): Record<string, string> {
  return {
    "x-rapidapi-key": getZillowApiKey(),
    "x-rapidapi-host": host,
  };
}

function extractZestimate(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const candidates = [
    record.zestimate,
    (record.property as Record<string, unknown> | undefined)?.zestimate,
    (record.data as Record<string, unknown> | undefined)?.zestimate,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number") return candidate;
  }
  return null;
}

async function searchProperties(query: string): Promise<Array<Record<string, unknown>>> {
  const host = getZillowHost();
  const res = await fetch(
    `https://${host}/propertyExtendedSearch?location=${encodeURIComponent(query)}`,
    { headers: zillowHeaders(host) }
  );
  if (!res.ok) {
    throw new Error(`Zillow address search failed for "${query}": ${res.status}`);
  }
  const data = (await res.json()) as { props?: Array<Record<string, unknown>> };
  return data.props ?? [];
}

/** Resolves a free-text address to a Zillow Property ID via the search endpoint. */
async function findZpid(address: string): Promise<string> {
  const props = await searchProperties(address);
  const zpid = props[0]?.zpid;
  if (zpid == null) {
    throw new Error(`No property found for "${address}"`);
  }
  return String(zpid);
}

function formatPropAddress(prop: Record<string, unknown>): string | null {
  if (typeof prop.address === "string") return prop.address;
  const { streetAddress, city, state, zipcode } = prop;
  if (typeof streetAddress === "string" && typeof city === "string" && typeof state === "string") {
    return `${streetAddress}, ${city}, ${state}${typeof zipcode === "string" ? ` ${zipcode}` : ""}`;
  }
  return null;
}

export interface AddressSuggestion {
  address: string;
  zpid: string;
}

/** Live address suggestions for a partial query, for an autocomplete dropdown. */
export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  let props: Array<Record<string, unknown>>;
  try {
    props = await searchProperties(query);
  } catch {
    return [];
  }
  const results: AddressSuggestion[] = [];
  for (const prop of props) {
    const address = formatPropAddress(prop);
    if (address && prop.zpid != null) {
      results.push({ address, zpid: String(prop.zpid) });
      if (results.length >= 5) break;
    }
  }
  return results;
}

/** Looks up a live Zestimate for an address via a RapidAPI Zillow data provider. */
export async function fetchZestimate(address: string): Promise<number> {
  const zpid = await findZpid(address);
  const host = getZillowHost();
  const res = await fetch(`https://${host}/property?zpid=${zpid}`, {
    headers: zillowHeaders(host),
  });
  if (!res.ok) {
    throw new Error(`Zillow property lookup failed for "${address}" (zpid ${zpid}): ${res.status}`);
  }
  const zestimate = extractZestimate(await res.json());
  if (zestimate == null) {
    throw new Error(`No Zestimate found for "${address}"`);
  }
  return zestimate;
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
