ALTER TABLE account ADD COLUMN precious_metal TEXT;
ALTER TABLE account ADD COLUMN metal_troy_oz REAL;

CREATE TABLE spot_price (
  metal TEXT PRIMARY KEY,
  price_usd REAL NOT NULL,
  updated_at INTEGER NOT NULL
);
