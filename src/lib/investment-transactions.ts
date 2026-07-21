import type { AssetClass } from "@/lib/asset-classes";

export interface InvestmentTransactionRow {
  id: string;
  account_id: string;
  account_name: string;
  asset_class: AssetClass;
  security_name: string | null;
  date: string;
  name: string;
  amount: number;
  quantity: number | null;
  price: number | null;
  type: string;
  subtype: string;
}

export interface InvestmentBreakdownRow {
  account_id: string;
  account_name: string;
  asset_class: AssetClass;
  contributions: number;
  distributions: number;
  count: number;
}

export const INVESTMENT_ASSET_CLASSES = ["brokerage", "retirement", "crypto"] as const;

/**
 * Buys (and cash deposits) count as contributions, sells (and cash
 * withdrawals) count as distributions -- dividends, fees, and in-kind
 * transfers don't represent new money moving in or out, so they're excluded
 * from both. Plaid's investment transaction types/subtypes are documented at
 * https://plaid.com/docs/api/accounts/#investment-transaction-types-schema.
 */
export function classifyInvestmentFlow(
  type: string,
  subtype: string
): "contribution" | "distribution" | null {
  if (type === "buy" && (subtype === "buy" || subtype === "buy to cover")) return "contribution";
  if (type === "sell" && (subtype === "sell" || subtype === "sell short")) return "distribution";
  if (type === "cash") {
    if (subtype === "contribution" || subtype === "deposit") return "contribution";
    if (subtype === "withdrawal" || subtype === "distribution") return "distribution";
  }
  return null;
}

function normalizeAssetClasses(assetClasses?: string[]): string[] {
  const classes = (assetClasses ?? []).filter((c) =>
    (INVESTMENT_ASSET_CLASSES as readonly string[]).includes(c)
  );
  return classes.length > 0 ? classes : [...INVESTMENT_ASSET_CLASSES];
}

interface DatedAmount {
  date: string;
  cents: number;
}

/**
 * Same-day "buys" of a settlement/money-market fund (Fidelity's automatic
 * sweep being the common case) are often just Plaid's record of already-
 * counted cash -- a contribution, deposit, dividend, or interest payout --
 * landing in a fund, not new money on top of it. When a day's total buys are
 * fully covered by that day's cash-in (which may span several contribution
 * rows swept into one combined buy, e.g. an employer + employee HSA
 * contribution on the same day), drop the buys instead of double-counting
 * them as a second contribution. Mirrors the same logic for sells against
 * withdrawals. Buys/sells that aren't fully covered are returned (with their
 * date) for a second, account-wide pass that nets out fund exchanges.
 */
function splitDateGroup(
  date: string,
  rows: Array<{ type: string; subtype: string; amount: number }>
): {
  unmatchedBuys: DatedAmount[];
  unmatchedSells: DatedAmount[];
  cashDeposits: DatedAmount[];
  cashWithdrawals: DatedAmount[];
} {
  const buys: number[] = [];
  const sells: number[] = [];
  const cashDepositRows: number[] = [];
  const cashWithdrawalRows: number[] = [];
  let cashIn = 0;
  let cashOut = 0;
  let cashNeutral = 0;

  for (const row of rows) {
    const cents = Math.round(Math.abs(row.amount) * 100);
    if (row.type === "buy" && (row.subtype === "buy" || row.subtype === "buy to cover")) {
      buys.push(cents);
    } else if (row.type === "sell" && (row.subtype === "sell" || row.subtype === "sell short")) {
      sells.push(cents);
    } else if (row.type === "cash") {
      if (row.subtype === "contribution" || row.subtype === "deposit") {
        cashIn += cents;
        cashDepositRows.push(cents);
      } else if (row.subtype === "withdrawal" || row.subtype === "distribution") {
        cashOut += cents;
        cashWithdrawalRows.push(cents);
      } else if (row.subtype === "dividend" || row.subtype === "interest") {
        cashNeutral += cents;
      }
    }
  }

  const buysTotal = buys.reduce((a, b) => a + b, 0);
  const sellsTotal = sells.reduce((a, b) => a + b, 0);
  const buysAreSwept = buysTotal > 0 && buysTotal <= cashIn + cashNeutral;
  const sellsAreSwept = sellsTotal > 0 && sellsTotal <= cashOut;

  return {
    unmatchedBuys: buysAreSwept ? [] : buys.map((cents) => ({ date, cents })),
    unmatchedSells: sellsAreSwept ? [] : sells.map((cents) => ({ date, cents })),
    cashDeposits: cashDepositRows.map((cents) => ({ date, cents })),
    cashWithdrawals: cashWithdrawalRows.map((cents) => ({ date, cents })),
  };
}

const EXCHANGE_WINDOW_DAYS = 5;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

/**
 * Matches each `need` amount against a `pool` entry of the exact same
 * dollar amount within a few days of it (nearest date wins), anywhere in
 * the account. Used for two distinct fund-exchange shapes: a buy funded by
 * a sell of a different security, and a buy or sell funded by redeeming or
 * sweeping a money-market/settlement fund position -- which Plaid reports
 * as a plain cash withdrawal/deposit, not a sell/buy. Either way it's money
 * moving between holdings inside the account, not new money contributed or
 * withdrawn. One leg can settle a day or two before the other posts, so
 * this isn't limited to same-day pairs the way the cash-vs-buy/sell
 * same-day sweep check above is.
 */
function netAmounts(
  need: DatedAmount[],
  pool: DatedAmount[]
): { unmatchedNeed: DatedAmount[]; unmatchedPool: DatedAmount[] } {
  const remainingPool = [...pool];
  const unmatchedNeed: DatedAmount[] = [];

  for (const item of need) {
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < remainingPool.length; i++) {
      const candidate = remainingPool[i];
      if (candidate.cents !== item.cents) continue;
      const diff = daysBetween(item.date, candidate.date);
      if (diff <= EXCHANGE_WINDOW_DAYS && diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) remainingPool.splice(bestIdx, 1);
    else unmatchedNeed.push(item);
  }

  return { unmatchedNeed, unmatchedPool: remainingPool };
}

function netAccountFlows(
  rows: Array<{ date: string; type: string; subtype: string; amount: number }>
): { contributions: number; distributions: number } {
  const byDate = new Map<string, Array<{ type: string; subtype: string; amount: number }>>();
  for (const row of rows) {
    const group = byDate.get(row.date) ?? [];
    group.push(row);
    byDate.set(row.date, group);
  }

  let unmatchedBuys: DatedAmount[] = [];
  let unmatchedSells: DatedAmount[] = [];
  let cashDeposits: DatedAmount[] = [];
  let cashWithdrawals: DatedAmount[] = [];
  for (const [date, group] of byDate) {
    const r = splitDateGroup(date, group);
    unmatchedBuys = unmatchedBuys.concat(r.unmatchedBuys);
    unmatchedSells = unmatchedSells.concat(r.unmatchedSells);
    cashDeposits = cashDeposits.concat(r.cashDeposits);
    cashWithdrawals = cashWithdrawals.concat(r.cashWithdrawals);
  }

  // Buys vs sells: a sale funding a purchase of a different security.
  const buysVsSells = netAmounts(unmatchedBuys, unmatchedSells);
  // Remaining buys vs cash withdrawals: redeeming a money-market/settlement
  // fund position (reported as a cash withdrawal, not a sell) to fund a
  // purchase -- e.g. selling money-market shares to buy an investment.
  const buysVsWithdrawals = netAmounts(buysVsSells.unmatchedNeed, cashWithdrawals);
  // Remaining sells vs cash deposits: sale proceeds swept into a
  // money-market/settlement fund position (reported as a cash deposit, not
  // a buy).
  const sellsVsDeposits = netAmounts(buysVsSells.unmatchedPool, cashDeposits);

  const sum = (values: DatedAmount[]) => values.reduce((a, b) => a + b.cents, 0) / 100;

  return {
    contributions: sum(buysVsWithdrawals.unmatchedNeed) + sum(sellsVsDeposits.unmatchedPool),
    distributions: sum(sellsVsDeposits.unmatchedNeed) + sum(buysVsWithdrawals.unmatchedPool),
  };
}

export async function getInvestmentBreakdown(
  db: D1Database,
  opts: { from?: string; to?: string; assetClasses?: string[] }
): Promise<InvestmentBreakdownRow[]> {
  const classes = normalizeAssetClasses(opts.assetClasses);
  const conditions = [`a.asset_class IN (${classes.map(() => "?").join(", ")})`, "a.is_closed = 0", "a.is_hidden = 0"];
  const bindings: unknown[] = [...classes];
  if (opts.from) {
    conditions.push("it.date >= ?");
    bindings.push(opts.from);
  }
  if (opts.to) {
    conditions.push("it.date <= ?");
    bindings.push(opts.to);
  }

  const result = await db
    .prepare(
      `SELECT a.id as account_id, a.name as account_name, a.asset_class, it.date, it.type, it.subtype, it.amount
       FROM investment_transaction it
       JOIN account a ON a.id = it.account_id
       WHERE ${conditions.join(" AND ")}`
    )
    .bind(...bindings)
    .all<{
      account_id: string;
      account_name: string;
      asset_class: AssetClass;
      date: string;
      type: string;
      subtype: string;
      amount: number;
    }>();

  const accountMeta = new Map<string, { account_name: string; asset_class: AssetClass }>();
  const rowsByAccount = new Map<string, Array<{ date: string; type: string; subtype: string; amount: number }>>();
  const counts = new Map<string, number>();
  for (const row of result.results ?? []) {
    if (classifyInvestmentFlow(row.type, row.subtype)) {
      counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
    }
    accountMeta.set(row.account_id, { account_name: row.account_name, asset_class: row.asset_class });
    const list = rowsByAccount.get(row.account_id) ?? [];
    list.push({ date: row.date, type: row.type, subtype: row.subtype, amount: row.amount });
    rowsByAccount.set(row.account_id, list);
  }

  const byAccount = new Map<string, InvestmentBreakdownRow>();
  for (const [accountId, rows] of rowsByAccount) {
    const meta = accountMeta.get(accountId)!;
    const flows = netAccountFlows(rows);
    byAccount.set(accountId, {
      account_id: accountId,
      account_name: meta.account_name,
      asset_class: meta.asset_class,
      contributions: flows.contributions,
      distributions: flows.distributions,
      count: counts.get(accountId) ?? 0,
    });
  }

  return [...byAccount.values()].sort((a, b) => b.contributions - a.contributions);
}

export async function listInvestmentTransactions(
  db: D1Database,
  opts: {
    from?: string;
    to?: string;
    assetClasses?: string[];
    accountId?: string;
    sort?: "recent" | "amount";
    limit?: number;
    offset?: number;
  }
): Promise<InvestmentTransactionRow[]> {
  const classes = normalizeAssetClasses(opts.assetClasses);
  const conditions = [`a.asset_class IN (${classes.map(() => "?").join(", ")})`, "a.is_closed = 0", "a.is_hidden = 0"];
  const bindings: unknown[] = [...classes];
  if (opts.accountId) {
    conditions.push("it.account_id = ?");
    bindings.push(opts.accountId);
  }
  if (opts.from) {
    conditions.push("it.date >= ?");
    bindings.push(opts.from);
  }
  if (opts.to) {
    conditions.push("it.date <= ?");
    bindings.push(opts.to);
  }

  const orderBy =
    opts.sort === "amount" ? "ORDER BY ABS(it.amount) DESC, it.date DESC" : "ORDER BY it.date DESC";
  const limit = Math.min(opts.limit ?? 100, 500);
  const offset = opts.offset ?? 0;

  const result = await db
    .prepare(
      `SELECT it.id, it.account_id, a.name as account_name, a.asset_class, it.security_name,
              it.date, it.name, it.amount, it.quantity, it.price, it.type, it.subtype
       FROM investment_transaction it
       JOIN account a ON a.id = it.account_id
       WHERE ${conditions.join(" AND ")}
       ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .bind(...bindings, limit, offset)
    .all<InvestmentTransactionRow>();

  return result.results ?? [];
}
