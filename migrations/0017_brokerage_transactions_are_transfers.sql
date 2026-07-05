-- Brokerage account activity (buys, sells, dividends, cash sweeps) is never
-- spending -- it was falling through to cat_other because Plaid/MX don't tag
-- it with a personal-finance category. Recategorize existing auto-categorized
-- transactions on brokerage accounts as transfers; leave manual overrides alone.
UPDATE "transaction"
SET category_id = 'cat_transfer', updated_at = datetime('now')
WHERE category_source != 'manual'
  AND category_id != 'cat_transfer'
  AND account_id IN (SELECT id FROM account WHERE asset_class = 'brokerage');
