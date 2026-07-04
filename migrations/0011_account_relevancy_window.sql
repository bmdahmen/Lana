-- Accounts can now carry a relevancy window (relevant_from/relevant_until).
-- Unlike is_closed (which hides an account everywhere, including its past
-- account_balance_history rows), a relevancy window keeps historical rows
-- visible in the net-worth-by-category chart but excludes the account from
-- "today"'s live balance once relevant_until has passed -- for La Lana
-- backfill accounts that have since been superseded by real Plaid/MX-linked
-- accounts in the same category and shouldn't double-count going forward.
--
-- Only categories with an actual live replacement get a relevancy window
-- (cash, brokerage, retirement, crypto, liabilities). Real estate and hard
-- assets have no live-tracked equivalent yet, so those two La Lana accounts
-- stay ordinary ongoing manual accounts -- excluding them would just drop
-- real net worth (e.g. the house) with nothing to replace it.

ALTER TABLE account ADD COLUMN relevant_from TEXT;
ALTER TABLE account ADD COLUMN relevant_until TEXT;

UPDATE account
SET relevant_from = '2015-10-31', relevant_until = '2026-06-30', is_closed = 0
WHERE id IN (
  'acct_lalana_cash',
  'acct_lalana_brokerage',
  'acct_lalana_retirement',
  'acct_lalana_crypto',
  'acct_lalana_liabilities'
);
