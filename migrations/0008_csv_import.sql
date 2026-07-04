ALTER TABLE "transaction" ADD COLUMN import_hash TEXT;

CREATE UNIQUE INDEX idx_transaction_import_hash ON "transaction" (import_hash);
