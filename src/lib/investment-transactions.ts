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
      `SELECT a.id as account_id, a.name as account_name, a.asset_class, it.type, it.subtype, it.amount
       FROM investment_transaction it
       JOIN account a ON a.id = it.account_id
       WHERE ${conditions.join(" AND ")}`
    )
    .bind(...bindings)
    .all<{ account_id: string; account_name: string; asset_class: AssetClass; type: string; subtype: string; amount: number }>();

  const byAccount = new Map<string, InvestmentBreakdownRow>();
  for (const row of result.results ?? []) {
    const flow = classifyInvestmentFlow(row.type, row.subtype);
    if (!flow) continue;

    const existing = byAccount.get(row.account_id) ?? {
      account_id: row.account_id,
      account_name: row.account_name,
      asset_class: row.asset_class,
      contributions: 0,
      distributions: 0,
      count: 0,
    };
    if (flow === "contribution") existing.contributions += Math.abs(row.amount);
    else existing.distributions += Math.abs(row.amount);
    existing.count += 1;
    byAccount.set(row.account_id, existing);
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
