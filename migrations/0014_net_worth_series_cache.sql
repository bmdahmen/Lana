-- Caches the full (since-inception) net-worth-by-class series as JSON so
-- range switches and page loads don't re-run the balance-history join and
-- carry-forward aggregation on every request. Refreshed whenever
-- recomputeNetWorth actually recomputes balances (see lib/sync.ts), which is
-- throttled to at most once per RECOMPUTE_THROTTLE_MS window.
CREATE TABLE net_worth_series_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
