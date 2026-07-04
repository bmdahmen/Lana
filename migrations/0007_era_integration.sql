ALTER TABLE account ADD COLUMN era_account_group_key TEXT;
ALTER TABLE "transaction" ADD COLUMN era_transaction_id TEXT;

CREATE UNIQUE INDEX idx_account_era_account_group_key ON account (era_account_group_key);
CREATE UNIQUE INDEX idx_transaction_era_transaction_id ON "transaction" (era_transaction_id);
