ALTER TABLE app_user ADD COLUMN mx_user_guid TEXT;

CREATE TABLE mx_member (
  id TEXT PRIMARY KEY,
  mx_member_guid TEXT NOT NULL UNIQUE,
  institution_code TEXT,
  institution_name TEXT,
  status TEXT NOT NULL DEFAULT 'good',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE account ADD COLUMN mx_member_id TEXT REFERENCES mx_member(id) ON DELETE CASCADE;
ALTER TABLE account ADD COLUMN mx_account_guid TEXT;

ALTER TABLE "transaction" ADD COLUMN mx_transaction_guid TEXT;

CREATE INDEX idx_account_mx_member ON account (mx_member_id);
CREATE UNIQUE INDEX idx_account_mx_account_guid ON account (mx_account_guid);
CREATE UNIQUE INDEX idx_transaction_mx_transaction_guid ON "transaction" (mx_transaction_guid);
