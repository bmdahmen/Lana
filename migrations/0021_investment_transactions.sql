-- Real brokerage/retirement buy/sell/cash activity from Plaid's Investments
-- product (separate from the regular Transactions product, which never
-- returns this for investment-type accounts -- see lib/sync.ts).
CREATE TABLE investment_transaction (
  id TEXT PRIMARY KEY,
  plaid_investment_transaction_id TEXT UNIQUE,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  security_name TEXT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  quantity REAL,
  price REAL,
  fees REAL,
  type TEXT NOT NULL,
  subtype TEXT NOT NULL,
  iso_currency_code TEXT DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_investment_transaction_account_date ON investment_transaction (account_id, date);
