-- Single-user auth. One row.
CREATE TABLE app_user (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per Plaid Item (a login at one institution).
CREATE TABLE plaid_item (
  id TEXT PRIMARY KEY,
  plaid_item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  status TEXT NOT NULL DEFAULT 'good', -- good | login_required | error
  error_message TEXT,
  cursor TEXT, -- Plaid /transactions/sync cursor
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  plaid_item_id TEXT REFERENCES plaid_item(id) ON DELETE CASCADE,
  plaid_account_id TEXT UNIQUE,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL, -- depository | credit | loan | investment | other
  subtype TEXT,
  mask TEXT,
  current_balance REAL,
  available_balance REAL,
  iso_currency_code TEXT DEFAULT 'USD',
  is_manual INTEGER NOT NULL DEFAULT 0,
  is_asset INTEGER NOT NULL DEFAULT 1, -- 0 for liabilities (credit/loan)
  is_closed INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES category(id) ON DELETE SET NULL,
  icon TEXT,
  is_income INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE "transaction" (
  id TEXT PRIMARY KEY,
  plaid_transaction_id TEXT UNIQUE,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  amount REAL NOT NULL, -- positive = money out, negative = money in (Plaid convention)
  iso_currency_code TEXT DEFAULT 'USD',
  date TEXT NOT NULL,
  authorized_date TEXT,
  name TEXT NOT NULL,
  merchant_name TEXT,
  category_id TEXT REFERENCES category(id) ON DELETE SET NULL,
  plaid_category TEXT, -- raw Plaid personal_finance_category.primary, used as fallback/default
  pending INTEGER NOT NULL DEFAULT 0,
  is_manual INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE category_rule (
  id TEXT PRIMARY KEY,
  match_field TEXT NOT NULL, -- merchant_name | name
  match_type TEXT NOT NULL DEFAULT 'contains', -- contains | equals
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE account_balance_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  current_balance REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, date)
);

CREATE TABLE net_worth_snapshot (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  total_assets REAL NOT NULL,
  total_liabilities REAL NOT NULL,
  net_worth REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transaction_account_date ON "transaction" (account_id, date);
CREATE INDEX idx_transaction_category ON "transaction" (category_id);
CREATE INDEX idx_account_plaid_item ON account (plaid_item_id);
CREATE INDEX idx_balance_history_date ON account_balance_history (date);
