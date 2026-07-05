ALTER TABLE spot_price RENAME COLUMN metal TO symbol;
ALTER TABLE account ADD COLUMN crypto_symbol TEXT;
ALTER TABLE account ADD COLUMN crypto_amount REAL;
