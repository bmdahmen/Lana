export type AssetClass =
  | "cash"
  | "brokerage"
  | "retirement"
  | "crypto"
  | "real_estate"
  | "hard_asset"
  | "precious_metals"
  | "liabilities"
  | "other";

export const ASSET_CLASSES: { id: AssetClass; label: string; colorVar: string }[] = [
  { id: "cash", label: "Cash", colorVar: "--chart-cash" },
  { id: "brokerage", label: "Brokerage", colorVar: "--chart-brokerage" },
  { id: "retirement", label: "Retirement", colorVar: "--chart-retirement" },
  { id: "crypto", label: "Crypto", colorVar: "--chart-crypto" },
  { id: "real_estate", label: "Real Estate", colorVar: "--chart-real-estate" },
  { id: "hard_asset", label: "Hard Assets", colorVar: "--chart-hard-asset" },
  { id: "precious_metals", label: "Precious Metals", colorVar: "--chart-precious-metals" },
  { id: "liabilities", label: "Liabilities", colorVar: "--chart-liabilities" },
  { id: "other", label: "Other", colorVar: "--chart-other" },
];

/**
 * The classes shown in net-worth-by-category graphs: liabilities are netted
 * into real estate as home equity (see computeNetWorthSeries) rather than
 * shown as their own line, so this list excludes "liabilities" and relabels
 * "real_estate" accordingly. Everywhere else (Accounts page, category
 * pickers, CSV import) still uses ASSET_CLASSES with its normal labels.
 */
export const NET_WORTH_DISPLAY_CLASSES = ASSET_CLASSES.filter(
  (cls) => cls.id !== "liabilities"
).map((cls) => (cls.id === "real_estate" ? { ...cls, label: "Equity" } : cls));

export const PRECIOUS_METALS = ["gold", "silver"] as const;
export type PreciousMetal = (typeof PRECIOUS_METALS)[number];

export const CRYPTOCURRENCIES = ["btc", "eth"] as const;
export type Cryptocurrency = (typeof CRYPTOCURRENCIES)[number];

const RETIREMENT_SUBTYPES = new Set([
  "401k",
  "403b",
  "457b",
  "ira",
  "roth",
  "roth 401k",
  "sep ira",
  "simple ira",
  "pension",
  "profit sharing plan",
  "money purchase plan",
  "thrift savings plan",
  "retirement",
  "keogh",
  "sarsep",
  "ugma",
  "utma",
]);

export function derivePlaidAssetClass(type: string, subtype: string | null): AssetClass {
  if (type === "depository") return "cash";
  if (type === "credit" || type === "loan") return "liabilities";
  if (type === "investment") {
    if (subtype === "crypto exchange") return "crypto";
    if (subtype && RETIREMENT_SUBTYPES.has(subtype)) return "retirement";
    return "brokerage";
  }
  return "other";
}

export function isAssetClassLiability(assetClass: AssetClass): boolean {
  return assetClass === "liabilities";
}
