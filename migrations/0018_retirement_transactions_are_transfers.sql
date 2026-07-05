-- Same reasoning as 0017, extended to retirement accounts (401k, IRA, etc.):
-- contributions, dividends, and balance activity there aren't spending either.
UPDATE "transaction"
SET category_id = 'cat_transfer', updated_at = datetime('now')
WHERE category_source != 'manual'
  AND category_id != 'cat_transfer'
  AND account_id IN (SELECT id FROM account WHERE asset_class = 'retirement');
