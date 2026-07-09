-- Multi-user support: each account/item belongs to whichever household
-- member's Plaid credentials (or manual entry) it came from, defaulting
-- existing rows to 'brian' since every account so far was his.
ALTER TABLE account ADD COLUMN owner TEXT NOT NULL DEFAULT 'brian';
ALTER TABLE plaid_item ADD COLUMN owner TEXT NOT NULL DEFAULT 'brian';

-- app_user was a single-row (id = 1) table. Recreate it keyed by owner id
-- so a second household member can have their own Google identity row,
-- preserving the existing row's Google linkage under id = 'brian' so that
-- login isn't disrupted.
CREATE TABLE app_user_new (
  id TEXT PRIMARY KEY CHECK (id IN ('brian', 'emily')),
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO app_user_new (id, google_sub, email, name, avatar, created_at)
SELECT 'brian', google_sub, email, name, avatar, created_at FROM app_user WHERE id = 1;

DROP TABLE app_user;
ALTER TABLE app_user_new RENAME TO app_user;
