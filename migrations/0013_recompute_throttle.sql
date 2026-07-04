-- Tracks when account balances (metal, real estate, net worth) were last
-- fully recomputed, so page loads can skip redundant work within the
-- throttle window instead of recomputing on every visit.
CREATE TABLE recompute_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_recomputed_at INTEGER NOT NULL DEFAULT 0
);

INSERT INTO recompute_state (id, last_recomputed_at) VALUES (1, 0);
