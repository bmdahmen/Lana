CREATE TABLE spot_price_history (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  price_usd REAL NOT NULL,
  UNIQUE(symbol, date)
);
