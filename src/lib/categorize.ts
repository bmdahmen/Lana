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
  MEDICAL: "cat_health",
  PERSONAL_CARE: "cat_personal",
  GENERAL_SERVICES: "cat_other",
  GOVERNMENT_AND_NON_PROFIT: "cat_other",
  TRANSPORTATION: "cat_transportation",
  TRAVEL: "cat_travel",
  RENT_AND_UTILITIES: "cat_utilities",
  OTHER: "cat_other",
};

const DETAILED_CATEGORY_MAP: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "cat_groceries",
  GENERAL_SERVICES_EDUCATION: "cat_education",
};

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
  [/subscription/, "cat_subscriptions"],
  [/entertainment|movie|music|streaming|game/, "cat_entertainment"],
  [/health|medical|pharmacy|doctor|dental/, "cat_health"],
  [/travel|airline|hotel|flight/, "cat_travel"],
  [/personal care|salon|spa|gym|fitness/, "cat_personal"],
  [/education|tuition|student loan/, "cat_education"],
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
  match_field: "merchant_name" | "name";
  match_type: "contains" | "equals";
  match_value: string;
  category_id: string;
}

export function applyCategoryRules(
  rules: CategoryRule[],
  transaction: { name: string; merchant_name: string | null }
): string | null {
  for (const rule of rules) {
    const value = rule.match_field === "merchant_name" ? transaction.merchant_name : transaction.name;
    if (!value) continue;
    const haystack = value.toLowerCase();
    const needle = rule.match_value.toLowerCase();
    const matched = rule.match_type === "equals" ? haystack === needle : haystack.includes(needle);
    if (matched) return rule.category_id;
  }
  return null;
}
