DROP TABLE app_user;

CREATE TABLE app_user (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
