const PRIMARY_CATEGORY_MAP: Record<string, string> = {
  INCOME: "cat_income",
  TRANSFER_IN: "cat_transfer",
  TRANSFER_OUT: "cat_transfer",
  LOAN_PAYMENTS: "cat_housing",
  BANK_FEES: "cat_fees",
  ENTERTAINMENT: "cat_entertainment",
  FOOD_AND_DRINK: "cat_food",
  GENERAL_MERCHANDISE: "cat_shopping",
  HOME_IMPROVEMENT: "cat_housing",
  MEDICAL: "cat_shopping",
  PERSONAL_CARE: "cat_shopping",
  GENERAL_SERVICES: "cat_other",
  GOVERNMENT_AND_NON_PROFIT: "cat_other",
  TRANSPORTATION: "cat_transportation",
  TRAVEL: "cat_travel",
  RENT_AND_UTILITIES: "cat_utilities",
  OTHER: "cat_other",
};

const DETAILED_CATEGORY_MAP: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "cat_groceries",
  GENERAL_SERVICES_EDUCATION: "cat_entertainment",
  // Credit card payments move money to an account whose individual purchases
  // are already categorized elsewhere, so they aren't spending on their own.
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "cat_transfer",
};

// Brokerage and retirement accounts only ever see buys/sells/dividends,
// contributions, and cash moved in or out from other accounts -- none of
// that is spending, so it's always a transfer regardless of what Plaid
// calls it.
export function isInvestmentAssetClass(assetClass: string | null | undefined): boolean {
  return assetClass === "brokerage" || assetClass === "retirement";
}

export function defaultCategoryFor(
  primary: string | null | undefined,
  detailed: string | null | undefined
): string {
  if (detailed && DETAILED_CATEGORY_MAP[detailed]) {
    return DETAILED_CATEGORY_MAP[detailed];
  }
  if (primary && PRIMARY_CATEGORY_MAP[primary]) {
    return PRIMARY_CATEGORY_MAP[primary];
  }
  return "cat_other";
}

const LABEL_CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/paycheck|payroll|salary|income/, "cat_income"],
  [/transfer/, "cat_transfer"],
  [/rent|mortgage/, "cat_housing"],
  [/grocery|groceries|supermarket/, "cat_groceries"],
  [/utilit|electric|water bill|internet|cable/, "cat_utilities"],
  [/restaurant|dining|coffee|fast food/, "cat_food"],
  [/gas station|fuel|parking|uber|lyft|taxi|transit|transportation/, "cat_transportation"],
  [/subscription/, "cat_entertainment"],
  [/entertainment|movie|music|streaming|game/, "cat_entertainment"],
  [/health|medical|pharmacy|doctor|dental/, "cat_shopping"],
  [/travel|airline|hotel|flight/, "cat_travel"],
  [/personal care|salon|spa|gym|fitness/, "cat_shopping"],
  [/education|tuition|student loan/, "cat_entertainment"],
  [/fee|interest charge|service charge/, "cat_fees"],
  [/shopping|merchandise|retail|clothing/, "cat_shopping"],
];

export function defaultCategoryFromLabel(label: string | null | undefined): string {
  if (!label) return "cat_other";
  const lower = label.toLowerCase();
  for (const [pattern, categoryId] of LABEL_CATEGORY_KEYWORDS) {
    if (pattern.test(lower)) return categoryId;
  }
  return "cat_other";
}

export interface CategoryRule {
  match_field: "merchant_name" | "name" | "both";
  match_type: "contains" | "equals";
  // Merchant-name value for "merchant_name" or "both"; the sole value for "name".
  match_value: string;
  // Only used (and required) when match_field is "both" -- the value checked
  // against the raw description, independent of match_value's merchant text.
  description_value?: string | null;
  category_id: string;
}

function fieldMatches(value: string | null, matchType: "contains" | "equals", needle: string): boolean {
  if (!value) return false;
  const haystack = value.toLowerCase();
  return matchType === "equals" ? haystack === needle : haystack.includes(needle);
}

export function applyCategoryRules(
  rules: CategoryRule[],
  transaction: { name: string; merchant_name: string | null }
): string | null {
  for (const rule of rules) {
    let matched: boolean;
    if (rule.match_field === "both") {
      if (!rule.description_value) continue;
      matched =
        fieldMatches(transaction.merchant_name, rule.match_type, rule.match_value.toLowerCase()) &&
        fieldMatches(transaction.name, rule.match_type, rule.description_value.toLowerCase());
    } else {
      matched = fieldMatches(
        rule.match_field === "merchant_name" ? transaction.merchant_name : transaction.name,
        rule.match_type,
        rule.match_value.toLowerCase()
      );
    }
    if (matched) return rule.category_id;
  }
  return null;
}
