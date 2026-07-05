-- MX was never actually linked to any account (mx_member has always been
-- empty), and the integration code has been removed. Drop the now-dead
-- schema it left behind.
DROP INDEX IF EXISTS idx_account_mx_member;
DROP INDEX IF EXISTS idx_account_mx_account_guid;
DROP INDEX IF EXISTS idx_transaction_mx_transaction_guid;

ALTER TABLE account DROP COLUMN mx_member_id;
ALTER TABLE account DROP COLUMN mx_account_guid;
ALTER TABLE "transaction" DROP COLUMN mx_transaction_guid;
ALTER TABLE app_user DROP COLUMN mx_user_guid;

DROP TABLE IF EXISTS mx_member;
