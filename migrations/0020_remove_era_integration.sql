-- Era Context was only ever used for a one-time historical backfill of two
-- accounts, both since superseded by direct Plaid links (and now deleted).
-- No live integration code exists. Drop the now-dead era_* columns and
-- their unique indexes from the schema.
DROP INDEX IF EXISTS idx_account_era_account_group_key;
DROP INDEX IF EXISTS idx_transaction_era_transaction_id;

ALTER TABLE account DROP COLUMN era_account_group_key;
ALTER TABLE "transaction" DROP COLUMN era_transaction_id;
