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

/**
 * A same-day "buy" of a settlement/money-market fund (Fidelity's automatic
 * sweep being the common case) is often just Plaid's record of already-
 * counted cash -- a contribution, deposit, dividend, or interest payout --
 * landing in a fund, not new money on top of it. Pair each such buy off
 * against a matching same-day cash amount in the group (in cents, to dodge
 * float rounding) and drop it instead of double-counting it as a second
 * contribution. Mirrors the same logic for sells against withdrawals.
 */
function netAccountDateFlows(
  rows: Array<{ type: string; subtype: string; amount: number }>
): { contributions: number; distributions: number } {
  const buys: number[] = [];
  const sells: number[] = [];
  const cashIn: number[] = [];
  const cashOut: number[] = [];
  const cashNeutral: number[] = [];

  for (const row of rows) {
    const cents = Math.round(Math.abs(row.amount) * 100);
    if (row.type === "buy" && (row.subtype === "buy" || row.subtype === "buy to cover")) {
      buys.push(cents);
    } else if (row.type === "sell" && (row.subtype === "sell" || row.subtype === "sell short")) {
      sells.push(cents);
    } else if (row.type === "cash") {
      if (row.subtype === "contribution" || row.subtype === "deposit") cashIn.push(cents);
      else if (row.subtype === "withdrawal" || row.subtype === "distribution") cashOut.push(cents);
      else if (row.subtype === "dividend" || row.subtype === "interest") cashNeutral.push(cents);
    }
  }

  const consume = (pool: number[], amounts: number[]): number[] => {
    const remaining = [...pool];
    for (const amount of amounts) {
      const idx = remaining.indexOf(amount);
      if (idx !== -1) remaining.splice(idx, 1);
    }
    return remaining;
  };

  const unmatchedBuys = consume(buys, [...cashIn, ...cashNeutral]);
  const unmatchedSells = consume(sells, cashOut);

  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0) / 100;

  return {
    contributions: sum(cashIn) + sum(unmatchedBuys),
    distributions: sum(cashOut) + sum(unmatchedSells),
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
  const groups = new Map<string, Array<{ type: string; subtype: string; amount: number }>>();
  const counts = new Map<string, number>();
  for (const row of result.results ?? []) {
    if (classifyInvestmentFlow(row.type, row.subtype)) {
      counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
    }
    accountMeta.set(row.account_id, { account_name: row.account_name, asset_class: row.asset_class });
    const key = `${row.account_id}|${row.date}`;
    const group = groups.get(key) ?? [];
    group.push({ type: row.type, subtype: row.subtype, amount: row.amount });
    groups.set(key, group);
  }

  const byAccount = new Map<string, InvestmentBreakdownRow>();
  for (const [key, group] of groups) {
    const accountId = key.slice(0, key.lastIndexOf("|"));
    const meta = accountMeta.get(accountId)!;
    const flows = netAccountDateFlows(group);

    const existing = byAccount.get(accountId) ?? {
      account_id: accountId,
      account_name: meta.account_name,
      asset_class: meta.asset_class,
      contributions: 0,
      distributions: 0,
      count: 0,
    };
    existing.contributions += flows.contributions;
    existing.distributions += flows.distributions;
    byAccount.set(accountId, existing);
  }
  for (const [accountId, row] of byAccount) {
    row.count = counts.get(accountId) ?? 0;
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
