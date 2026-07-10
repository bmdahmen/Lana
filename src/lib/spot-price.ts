import {
  PRECIOUS_METALS,
  CRYPTOCURRENCIES,
  type PreciousMetal,
  type Cryptocurrency,
} from "@/lib/asset-classes";
import { newId } from "@/lib/db";

const SPOT_PRICE_MAX_AGE_MS = 60 * 60 * 1000;

type SpotSymbol = PreciousMetal | Cryptocurrency;

const METAL_SYMBOL: Record<PreciousMetal, "XAU" | "XAG"> = { gold: "XAU", silver: "XAG" };
const CRYPTO_SYMBOL: Record<Cryptocurrency, "BTC" | "ETH"> = { btc: "BTC", eth: "ETH" };

async function fetchMetalSpotPrices(): Promise<Record<PreciousMetal, number>> {
  const [gold, silver] = await Promise.all(
    PRECIOUS_METALS.map(async (metal) => {
      const res = await fetch(`https://api.gold-api.com/price/${METAL_SYMBOL[metal]}`);
      if (!res.ok) throw new Error(`Spot price fetch failed for ${metal}: ${res.status}`);
      const data = (await res.json()) as { price: number };
      return data.price;
    })
  );
  return { gold, silver };
}

// CoinGecko's public API consistently fails from Cloudflare Workers (shared
// egress IPs get rate-limited/blocked), so this uses Coinbase's public spot
// endpoint instead, which doesn't have that problem.
async function fetchCryptoSpotPrices(): Promise<Record<Cryptocurrency, number>> {
  const [btc, eth] = await Promise.all(
    CRYPTOCURRENCIES.map(async (coin) => {
      const res = await fetch(`https://api.coinbase.com/v2/prices/${CRYPTO_SYMBOL[coin]}-USD/spot`);
      if (!res.ok) throw new Error(`Spot price fetch failed for ${coin}: ${res.status}`);
      const data = (await res.json()) as { data: { amount: string } };
      return Number(data.data.amount);
    })
  );
  return { btc, eth };
}

async function refreshGroup<T extends SpotSymbol>(
  db: D1Database,
  symbols: readonly T[],
  cached: Map<SpotSymbol, { price_usd: number }>,
  fetcher: () => Promise<Record<T, number>>,
  now: number
): Promise<Record<T, number>> {
  try {
    const prices = await fetcher();
    await db.batch(
      symbols.map((symbol) =>
        db
          .prepare(
            `INSERT INTO spot_price (symbol, price_usd, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(symbol) DO UPDATE SET price_usd = excluded.price_usd, updated_at = excluded.updated_at`
          )
          .bind(symbol, prices[symbol], now)
      )
    );
    return prices;
  } catch (error) {
    console.error(
      `Failed to refresh spot prices for ${symbols.join(", ")}, falling back to cache`,
      (error as Error).message
    );
    // Even with no prior cache (e.g. the very first crypto/metal account ever
    // added), fall back to 0 rather than throwing -- a transient price-API
    // outage should never block adding the account. The balance corrects
    // itself the next time this succeeds (next add, or the daily cron).
    const fallback = {} as Record<T, number>;
    for (const symbol of symbols) {
      const row = cached.get(symbol);
      fallback[symbol] = row?.price_usd ?? 0;
    }
    return fallback;
  }
}

/** Prices are USD per unit (troy ounce for metals, coin for crypto), cached in D1 and refreshed at most once an hour. */
export async function getSpotPrices(db: D1Database): Promise<Record<SpotSymbol, number>> {
  const rows = await db
    .prepare("SELECT symbol, price_usd, updated_at FROM spot_price")
    .all<{ symbol: SpotSymbol; price_usd: number; updated_at: number }>();
  const cached = new Map((rows.results ?? []).map((r) => [r.symbol, r]));

  const now = Date.now();
  const isStale = (symbol: SpotSymbol) => {
    const row = cached.get(symbol);
    return !row || now - row.updated_at > SPOT_PRICE_MAX_AGE_MS;
  };

  const metals =
    isStale("gold") || isStale("silver")
      ? await refreshGroup(db, PRECIOUS_METALS, cached, fetchMetalSpotPrices, now)
      : { gold: cached.get("gold")!.price_usd, silver: cached.get("silver")!.price_usd };

  const cryptos =
    isStale("btc") || isStale("eth")
      ? await refreshGroup(db, CRYPTOCURRENCIES, cached, fetchCryptoSpotPrices, now)
      : { btc: cached.get("btc")!.price_usd, eth: cached.get("eth")!.price_usd };

  return { ...metals, ...cryptos };
}

export async function recomputeSpotPriceAccountBalances(db: D1Database): Promise<void> {
  const hasSpotAccounts = await db
    .prepare(
      "SELECT 1 FROM account WHERE (precious_metal IS NOT NULL OR crypto_symbol IS NOT NULL) AND is_closed = 0 LIMIT 1"
    )
    .first();
  if (!hasSpotAccounts) return;

  const prices = await getSpotPrices(db);
  const today = new Date().toISOString().slice(0, 10);
  const upsertHistory = (symbol: PreciousMetal, price: number) =>
    db
      .prepare(
        `INSERT INTO spot_price_history (id, symbol, date, price_usd) VALUES (?, ?, ?, ?)
         ON CONFLICT(symbol, date) DO UPDATE SET price_usd = excluded.price_usd`
      )
      .bind(newId("sph"), symbol, today, price);

  await db.batch([
    db
      .prepare(
        `UPDATE account SET current_balance = metal_troy_oz * ?, updated_at = datetime('now')
         WHERE precious_metal = 'gold' AND is_closed = 0`
      )
      .bind(prices.gold),
    db
      .prepare(
        `UPDATE account SET current_balance = metal_troy_oz * ?, updated_at = datetime('now')
         WHERE precious_metal = 'silver' AND is_closed = 0`
      )
      .bind(prices.silver),
    db
      .prepare(
        `UPDATE account SET current_balance = crypto_amount * ?, updated_at = datetime('now')
         WHERE crypto_symbol = 'btc' AND is_closed = 0`
      )
      .bind(prices.btc),
    db
      .prepare(
        `UPDATE account SET current_balance = crypto_amount * ?, updated_at = datetime('now')
         WHERE crypto_symbol = 'eth' AND is_closed = 0`
      )
      .bind(prices.eth),
    upsertHistory("gold", prices.gold),
    upsertHistory("silver", prices.silver),
  ]);
}

/** Daily spot-price history for one precious metal, oldest first. */
export async function getSpotPriceHistory(
  db: D1Database,
  symbol: PreciousMetal
): Promise<{ date: string; price_usd: number }[]> {
  const result = await db
    .prepare("SELECT date, price_usd FROM spot_price_history WHERE symbol = ? ORDER BY date ASC")
    .bind(symbol)
    .all<{ date: string; price_usd: number }>();
  return result.results ?? [];
}

/** Daily gold/silver ratio (troy-oz price of gold / troy-oz price of silver), oldest first. */
export async function getGsrHistory(db: D1Database): Promise<{ date: string; ratio: number }[]> {
  const result = await db
    .prepare(
      `SELECT g.date as date, g.price_usd / s.price_usd as ratio
       FROM spot_price_history g
       JOIN spot_price_history s ON s.symbol = 'silver' AND s.date = g.date
       WHERE g.symbol = 'gold' AND s.price_usd > 0
       ORDER BY g.date ASC`
    )
    .all<{ date: string; ratio: number }>();
  return result.results ?? [];
}
