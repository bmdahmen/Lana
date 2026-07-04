export type AssetClass =
  | "cash"
  | "brokerage"
  | "retirement"
  | "crypto"
  | "real_estate"
  | "hard_asset"
  | "liabilities"
  | "other";

export const ASSET_CLASSES: { id: AssetClass; label: string; colorVar: string }[] = [
  { id: "cash", label: "Cash", colorVar: "--chart-cash" },
  { id: "brokerage", label: "Brokerage", colorVar: "--chart-brokerage" },
  { id: "retirement", label: "Retirement", colorVar: "--chart-retirement" },
  { id: "crypto", label: "Crypto", colorVar: "--chart-crypto" },
  { id: "real_estate", label: "Real Estate", colorVar: "--chart-real-estate" },
  { id: "hard_asset", label: "Hard Assets", colorVar: "--chart-hard-asset" },
  { id: "liabilities", label: "Liabilities", colorVar: "--chart-liabilities" },
  { id: "other", label: "Other", colorVar: "--chart-other" },
];

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

export function deriveMxAssetClass(type: string, subtype: string | null): AssetClass {
  const upperType = type.toUpperCase();
  const lowerSubtype = subtype?.toLowerCase() ?? "";

  if (upperType === "CHECKING" || upperType === "SAVINGS") return "cash";
  if (upperType === "CREDIT_CARD" || upperType === "LOAN" || upperType === "MORTGAGE") {
    return "liabilities";
  }
  if (upperType === "INVESTMENT") {
    if (/401|403|ira|pension|retirement/.test(lowerSubtype)) return "retirement";
    return "brokerage";
  }
  return "other";
}

export function deriveEraAssetClass(type: string, name: string): AssetClass {
  const lowerType = type.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerType === "checking" || lowerType === "savings") return "cash";
  if (lowerType === "creditcard" || lowerType === "loan" || lowerType === "mortgage") {
    return "liabilities";
  }
  if (lowerType === "brokerage" || lowerType === "investment") {
    if (/ira|401k|401\(k\)|403b|pension|retirement/.test(lowerName)) return "retirement";
    if (/crypto/.test(lowerName)) return "crypto";
    return "brokerage";
  }
  return "other";
}
